import type {
  MemoryNode,
  MemorySourceRecord,
  Provenance,
  RuntimeScope,
} from "@mstrmnd/schemas";
import { GraphEngine } from "./graph-engine";
import { readObsidianSourceRecords } from "./obsidian-adapter";
import {
  localProvenance,
  resolveScope,
} from "./operator-scope";

export interface LoadSourceOptions {
  scope?: Partial<RuntimeScope>;
  /** Base provenance fields merged onto each record */
  provenance?: Partial<Provenance>;
}

export class MemoryEngine {
  private nodes: MemoryNode[] = [];
  private graph = new GraphEngine();

  /** Store a single memory node. Links it into the tag graph against
   *  every existing node that shares a tag. */
  store(node: MemoryNode): MemoryNode {
    if (!node.scope || !node.provenance) {
      throw new Error("MemoryNode requires scope and provenance");
    }
    for (const existing of this.nodes) {
      const shared = node.relationships.filter((t) =>
        existing.relationships.includes(t)
      );
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

  /** Look up a node by relative path or title (case-insensitive). */
  get(id: string): MemoryNode | undefined {
    const key = id.toLowerCase();
    return this.nodes.find(
      (n) => n.id.toLowerCase() === key || n.title.toLowerCase() === key
    );
  }

  /** The underlying relationship graph (tag-derived edges built on vault load). */
  get relationships(): GraphEngine {
    return this.graph;
  }

  get size(): number {
    return this.nodes.length;
  }

  /**
   * Tokenized, scored search over title + content + relationships (case-insensitive).
   * Title matches weigh more than content; relationship matches weigh least.
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
   * Load vendor-neutral source records into the memory graph.
   * Adapters must map into MemorySourceRecord before calling this.
   */
  loadSourceRecords(
    records: MemorySourceRecord[],
    options: LoadSourceOptions = {}
  ): MemoryNode[] {
    this.nodes = [];
    this.graph = new GraphEngine();
    const scope = resolveScope(options.scope);
    const baseProv = options.provenance ?? {};

    for (const record of records) {
      this.store({
        id: record.id,
        type: "memory",
        title: record.title,
        content: record.content,
        confidence: 1,
        relationships: record.tags,
        scope,
        provenance: {
          ...localProvenance(baseProv.source ?? "memory-source", {
            adapter: baseProv.adapter,
            doctrineRef: baseProv.doctrineRef,
            producedBy: baseProv.producedBy,
            confidence: baseProv.confidence,
          }),
          ...baseProv,
          source: baseProv.source ?? "memory-source",
          sourcePath: record.sourcePath ?? record.id,
          ingestedAt: baseProv.ingestedAt ?? new Date().toISOString(),
        },
      });
    }
    this.buildLinkGraph(records);
    return this.nodes;
  }

  /**
   * Convenience: load an Obsidian vault via the Obsidian adapter, then ingest
   * as scoped Operator Zero memory. Preserves the local MVP vault path.
   */
  async loadVault(
    vaultPath: string,
    options: LoadSourceOptions = {}
  ): Promise<MemoryNode[]> {
    const records = await readObsidianSourceRecords(vaultPath);
    return this.loadSourceRecords(records, {
      scope: options.scope,
      provenance: {
        source: "obsidian",
        adapter: "obsidian-vault-reader",
        ...options.provenance,
      },
    });
  }

  /** Resolve outbound links and shared folders into graph edges. */
  private buildLinkGraph(records: MemorySourceRecord[]): void {
    const byKey = new Map<string, string>();
    for (const n of records) {
      byKey.set(n.title.toLowerCase(), n.id);
      byKey.set(n.id.toLowerCase(), n.id);
      const withoutExt = n.id.replace(/\.md$/i, "");
      byKey.set(withoutExt.toLowerCase(), n.id);
    }
    for (const n of records) {
      for (const link of n.links) {
        const targetId = byKey.get(link.toLowerCase());
        if (targetId && targetId !== n.id) {
          this.graph.link(n.id, targetId, "link");
        }
      }
    }
    const byFolder = new Map<string, string[]>();
    for (const n of records) {
      if (!n.folder) continue;
      const list = byFolder.get(n.folder) ?? [];
      list.push(n.id);
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
const CONTENT_WEIGHT = 1;
const RELATIONSHIP_WEIGHT = 1;

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function scoreField(field: string, tokens: string[], weight: number): number {
  let score = 0;
  for (const tok of tokens) {
    if (field === tok) score += weight * 2;
    else if (field.includes(tok)) score += weight;
  }
  return score;
}

/** Score a node against query tokens. Title hits outrank content hits. */
function scoreNode(node: MemoryNode, tokens: string[]): number {
  const title = node.title.toLowerCase();
  const content = (node.content ?? "").toLowerCase();
  const rels = node.relationships.map((r) => r.toLowerCase());
  let score = scoreField(title, tokens, TITLE_WEIGHT);
  score += scoreField(content, tokens, CONTENT_WEIGHT);
  for (const rel of rels) {
    score += scoreField(rel, tokens, RELATIONSHIP_WEIGHT);
  }
  return score;
}
