import type { MemoryNode } from "@mstrmnd/schemas";
import { readVault, type VaultNote } from "@mstrmnd/connectors";
import { GraphEngine } from "./graph-engine";
import { VectorEngine } from "./vector-engine";

/** How a search query is matched against memory. */
export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface ScoredMemory {
  node: MemoryNode;
  score: number;
}

export class MemoryEngine {
  private nodes: MemoryNode[] = [];
  private graph = new GraphEngine();
  private vectors: VectorEngine;
  private indexed = false;

  constructor(vectors: VectorEngine = new VectorEngine()) {
    this.vectors = vectors;
  }

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

  /** The vector index backing semantic search. */
  get embeddings(): VectorEngine {
    return this.vectors;
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
    return { query, memories: this.scoreKeyword(tokens).map((s) => s.node) };
  }

  /** Keyword hits with their raw scores, highest first. */
  private scoreKeyword(tokens: string[]): ScoredMemory[] {
    return this.nodes
      .map((node) => ({ node, score: scoreNode(node, tokens) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Embed every loaded note so semantic search has something to match against.
   * Idempotent — repeated calls are cheap, and the VectorEngine's content-hash
   * cache means an unchanged vault skips the model entirely.
   */
  async buildVectorIndex(): Promise<number> {
    const entries = this.nodes.map((node) => ({
      id: node.id,
      // Title carries disproportionate signal in a vault, so lead with it.
      text: `${node.title}\n\n${node.content ?? ""}`.trim(),
    }));
    const count = await this.vectors.index(entries);
    this.indexed = true;
    return count;
  }

  /** Nearest notes by embedding similarity. Builds the index on first use. */
  async semanticSearch(query: string, limit = 10): Promise<ScoredMemory[]> {
    if (!this.indexed) await this.buildVectorIndex();
    const matches = await this.vectors.search(query, limit);
    const scored: ScoredMemory[] = [];
    for (const match of matches) {
      const node = this.get(match.id);
      if (node) scored.push({ node, score: match.score });
    }
    return scored;
  }

  /**
   * Blend keyword and semantic ranking. Each side is normalized against its own
   * top score before weighting, because raw keyword scores are unbounded counts
   * while cosine similarity is capped at 1 — comparing them directly would let
   * a single keyword-heavy note dominate every query.
   */
  async hybridSearch(
    query: string,
    limit = 10,
    keywordWeight = 0.5
  ): Promise<ScoredMemory[]> {
    const tokens = tokenize(query);
    const keyword = tokens.length > 0 ? this.scoreKeyword(tokens) : [];
    const semantic = await this.semanticSearch(query, Math.max(limit * 4, 40));

    const combined = new Map<string, { node: MemoryNode; score: number }>();
    const topKeyword = keyword[0]?.score ?? 0;
    const topSemantic = semantic[0]?.score ?? 0;
    const semanticWeight = 1 - keywordWeight;

    for (const { node, score } of keyword) {
      const weighted = topKeyword > 0 ? (score / topKeyword) * keywordWeight : 0;
      combined.set(node.id, { node, score: weighted });
    }
    for (const { node, score } of semantic) {
      const weighted = topSemantic > 0 ? (score / topSemantic) * semanticWeight : 0;
      const existing = combined.get(node.id);
      if (existing) existing.score += weighted;
      else combined.set(node.id, { node, score: weighted });
    }

    return [...combined.values()]
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Dispatch to the requested strategy. */
  async searchBy(
    query: string,
    mode: SearchMode = "keyword",
    limit = 10
  ): Promise<ScoredMemory[]> {
    if (mode === "semantic") return this.semanticSearch(query, limit);
    if (mode === "hybrid") return this.hybridSearch(query, limit);
    const tokens = tokenize(query);
    if (tokens.length === 0) {
      return this.nodes.slice(0, limit).map((node) => ({ node, score: 0 }));
    }
    return this.scoreKeyword(tokens).slice(0, limit);
  }

  /**
   * Load an Obsidian vault into the memory graph. Each note becomes a
   * `MemoryNode` of type 'memory', with its tags as relationships. Wikilinks
   * and shared folders become graph edges.
   */
  async loadVault(vaultPath: string): Promise<MemoryNode[]> {
    this.nodes = [];
    this.graph = new GraphEngine();
    this.vectors.clear();
    this.indexed = false;
    const notes: VaultNote[] = await readVault(vaultPath);
    for (const note of notes) {
      this.store({
        id: note.relativePath,
        type: "memory",
        title: note.title,
        content: note.body,
        confidence: 1,
        relationships: note.tags,
      });
    }
    this.buildLinkGraph(notes);
    return this.nodes;
  }

  /** Resolve `[[wikilinks]]` and shared folders into graph edges. */
  private buildLinkGraph(notes: VaultNote[]): void {
    const byKey = new Map<string, string>();
    for (const n of notes) {
      byKey.set(n.title.toLowerCase(), n.relativePath);
      byKey.set(n.relativePath.toLowerCase(), n.relativePath);
      const withoutExt = n.relativePath.replace(/\.md$/i, "");
      byKey.set(withoutExt.toLowerCase(), n.relativePath);
    }
    for (const n of notes) {
      for (const link of n.links) {
        const targetId = byKey.get(link.toLowerCase());
        if (targetId && targetId !== n.relativePath) {
          this.graph.link(n.relativePath, targetId, "link");
        }
      }
    }
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
const CONTENT_WEIGHT = 1;
const RELATIONSHIP_WEIGHT = 1;

/** Dropped from queries: they match almost every note and carry no intent.
 *  Kept deliberately short — an aggressive list would break searches for real
 *  note titles like "How To" or "The Plan". */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for", "from",
  "how", "i", "in", "is", "it", "of", "on", "or", "that", "the", "to", "was",
  "what", "when", "where", "which", "who", "why", "with",
]);

/** Substring matching below this length produces more noise than signal —
 *  "is" matches inside "display". Shorter tokens must match a field exactly. */
const MIN_SUBSTRING_LENGTH = 4;

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function scoreField(field: string, tokens: string[], weight: number): number {
  let score = 0;
  for (const tok of tokens) {
    if (field === tok) score += weight * 2;
    else if (tok.length >= MIN_SUBSTRING_LENGTH && field.includes(tok)) {
      score += weight;
    }
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
