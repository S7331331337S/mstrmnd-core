import type { MemoryNode } from "@mstrmnd/schemas";
import { readVault, type VaultNote } from "../../../connectors/obsidian/vault-reader";
import { GraphEngine } from "./graph-engine";

export class MemoryEngine {
  private nodes: MemoryNode[] = [];
  private graph = new GraphEngine();

  /** Store a single memory node. Links it into the tag graph against
   *  every existing node that shares a tag. */
  store(node: MemoryNode): MemoryNode {
    for (const existing of this.nodes) {
      const shared = node.relationships.filter((t) => existing.relationships.includes(t));
      for (const tag of shared) {
        this.graph.link(node.id, existing.id, `tag:${tag}`);
      }
    }
    this.nodes.push(node);
    return node;
  }

  /** Return all stored nodes. */
  all(): MemoryNode[] {
    return this.nodes;
  }

  /** The underlying relationship graph (tag-derived edges built on vault load). */
  get relationships(): GraphEngine {
    return this.graph;
  }

  get size(): number {
    return this.nodes.length;
  }

  /**
   * Tokenized, scored search over title + relationships (case-insensitive).
   * Title matches weigh more than relationship matches; partial tokens count.
   * Empty query returns everything. Results are sorted by descending score.
   */
  search(query: string): { query: string; memories: MemoryNode[] } {
    const tokens = tokenize(query);
    if (tokens.length === 0) {
      return { query, memories: [...this.nodes] };
    }
    const scored = this.nodes
      .map((node) => ({ node, score: scoreNode(node, tokens) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.node);
    return { query, memories: scored };
  }

  /**
   * Load an Obsidian vault into the memory graph. Each note becomes a
   * `MemoryNode` of type 'memory', with its tags as relationships. Wikilinks
   * and shared folders become graph edges.
   */
  async loadVault(vaultPath: string): Promise<MemoryNode[]> {
    const notes: VaultNote[] = await readVault(vaultPath);
    for (const note of notes) {
      this.store({
        id: note.relativePath,
        type: "memory",
        title: note.title,
        confidence: 1,
        relationships: note.tags,
      });
    }
    this.buildLinkGraph(notes);
    return this.nodes;
  }

  /** Resolve `[[wikilinks]]` and shared folders into graph edges. */
  private buildLinkGraph(notes: VaultNote[]): void {
    const byKey = new Map<string, string>(); // title or relativePath -> node id
    for (const n of notes) {
      byKey.set(n.title.toLowerCase(), n.relativePath);
      byKey.set(n.relativePath.toLowerCase(), n.relativePath);
    }
    for (const n of notes) {
      for (const link of n.links) {
        const targetId = byKey.get(link.toLowerCase());
        if (targetId && targetId !== n.relativePath) {
          this.graph.link(n.relativePath, targetId, "link");
        }
      }
    }
    // folder co-location (skip root-level notes)
    const byFolder = new Map<string, string[]>();
    for (const n of notes) {
      if (!n.folder) continue;
      const list = byFolder.get(n.folder) ?? [];
      list.push(n.relativePath);
      byFolder.set(n.folder, list);
    }
    for (const ids of byFolder.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          this.graph.link(ids[i], ids[j], "folder");
        }
      }
    }
  }
}

const TITLE_WEIGHT = 3;
const RELATIONSHIP_WEIGHT = 1;

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

/** Score a node against query tokens. Title hits outrank relationship hits;
 *  a token matching the whole field scores higher than a partial substring. */
function scoreNode(node: MemoryNode, tokens: string[]): number {
  const title = node.title.toLowerCase();
  const rels = node.relationships.map((r) => r.toLowerCase());
  let score = 0;
  for (const tok of tokens) {
    if (title === tok) score += TITLE_WEIGHT * 2;
    else if (title.includes(tok)) score += TITLE_WEIGHT;
    for (const rel of rels) {
      if (rel === tok) score += RELATIONSHIP_WEIGHT * 2;
      else if (rel.includes(tok)) score += RELATIONSHIP_WEIGHT;
    }
  }
  return score;
}
