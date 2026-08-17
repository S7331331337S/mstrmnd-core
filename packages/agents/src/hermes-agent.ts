import type { MemoryEngine } from "@mstrmnd/intelligence-core";
import type { IdentityModel, MemoryNode } from "@mstrmnd/schemas";
import { EMPTY_IDENTITY } from "@mstrmnd/intelligence-core";
import type { Reasoner, RetrievedPassage, Turn } from "./reasoner";
import { RetrievalReasoner } from "./reasoner";

export interface HermesOptions {
  /** How many direct search hits to ground on. */
  searchLimit?: number;
  /** How many graph neighbours to pull in behind the top hit. */
  expandLimit?: number;
  /** Characters of note body per passage. */
  excerptLength?: number;
}

export interface HermesAnswer {
  question: string;
  answer: string;
  passages: RetrievedPassage[];
  reasoner: string;
}

const DEFAULTS = { searchLimit: 5, expandLimit: 3, excerptLength: 600 };

/**
 * The Hermes agent loop: retrieve → expand → reason, carrying conversation
 * state across turns.
 *
 * Retrieval is hybrid search followed by one hop through the memory graph, so a
 * note that never matched the query lexically or semantically can still ground
 * the answer when it sits adjacent to something that did — which is the whole
 * point of keeping a graph alongside the vectors.
 */
export class HermesAgent {
  private readonly history: Turn[] = [];
  private readonly options: Required<HermesOptions>;

  constructor(
    private readonly memory: MemoryEngine,
    private readonly reasoner: Reasoner = new RetrievalReasoner(),
    private identity: IdentityModel = { ...EMPTY_IDENTITY },
    options: HermesOptions = {}
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  setIdentity(identity: IdentityModel): void {
    this.identity = identity;
  }

  /** Turns taken so far, oldest first. */
  get turns(): readonly Turn[] {
    return this.history;
  }

  reset(): void {
    this.history.length = 0;
  }

  /** Run one turn and record it in history. */
  async ask(question: string): Promise<HermesAnswer> {
    const passages = await this.retrieve(question);
    const answer = await this.reasoner.answer({
      question,
      passages,
      identity: this.identity,
      history: this.history,
    });
    this.history.push({ question, answer });
    return { question, answer, passages, reasoner: this.reasoner.name };
  }

  /** Hybrid search, then one hop through the graph behind the top hits. */
  private async retrieve(question: string): Promise<RetrievedPassage[]> {
    const hits = await this.memory.hybridSearch(question, this.options.searchLimit);
    const passages: RetrievedPassage[] = hits.map(({ node, score }) => ({
      id: node.id,
      title: node.title,
      excerpt: this.excerpt(node, question),
      score,
      via: "search",
    }));

    const seen = new Set(passages.map((p) => p.id));
    const graph = this.memory.relationships;
    let budget = this.options.expandLimit;

    for (const hit of hits) {
      if (budget <= 0) break;
      for (const neighborId of graph.neighbors(hit.node.id)) {
        if (budget <= 0) break;
        if (seen.has(neighborId)) continue;
        const node = this.memory.get(neighborId);
        if (!node) continue;
        seen.add(neighborId);
        budget--;
        passages.push({
          id: node.id,
          title: node.title,
          excerpt: this.excerpt(node, question),
          // Inherit a fraction of the hit's score: adjacency is weaker evidence
          // than a direct match, but still ranks above nothing.
          score: hit.score * 0.5,
          via: "graph",
        });
      }
    }

    return passages;
  }

  /** A window of note body centred on the first query-term hit. */
  private excerpt(node: MemoryNode, question: string): string {
    const body = (node.content ?? "").replace(/\s+/g, " ").trim();
    const max = this.options.excerptLength;
    if (body.length <= max) return body;

    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length > 2);
    const lower = body.toLowerCase();
    let at = -1;
    for (const term of terms) {
      at = lower.indexOf(term);
      if (at !== -1) break;
    }
    if (at === -1) return body.slice(0, max) + "…";

    const start = Math.max(0, at - Math.floor(max / 3));
    const slice = body.slice(start, start + max);
    return `${start > 0 ? "…" : ""}${slice}${start + max < body.length ? "…" : ""}`;
  }
}
