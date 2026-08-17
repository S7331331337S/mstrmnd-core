import type { IdentityModel } from "@mstrmnd/schemas";

/** A chunk of memory retrieved as grounding for an answer. */
export interface RetrievedPassage {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  /** How it surfaced: a direct search hit, or pulled in as a graph neighbour. */
  via: "search" | "graph";
}

export interface Turn {
  question: string;
  answer: string;
}

export interface ReasonerInput {
  question: string;
  passages: RetrievedPassage[];
  identity: IdentityModel;
  history: Turn[];
}

export interface Reasoner {
  readonly name: string;
  answer(input: ReasonerInput): Promise<string>;
}

/**
 * Extractive reasoner: no model, no network, no key. Assembles the retrieved
 * passages into a cited readout.
 *
 * This is deliberately not phrased as an answer in Hermes' own voice — without
 * a language model it cannot synthesize one, and dressing up retrieval as
 * synthesis would misrepresent what the loop actually did. It is the zero-config
 * default so the agent loop is useful before any provider is configured.
 */
export class RetrievalReasoner implements Reasoner {
  readonly name = "retrieval";

  async answer({ question, passages }: ReasonerInput): Promise<string> {
    if (passages.length === 0) {
      return `No notes in memory matched "${question}".`;
    }
    const lines = passages.map((p, i) => {
      const marker = p.via === "graph" ? " (linked)" : "";
      return `[${i + 1}] ${p.title}${marker} — ${p.id}\n    ${p.excerpt}`;
    });
    return [
      `${passages.length} passage(s) from memory relevant to "${question}":`,
      "",
      ...lines,
      "",
      "(extractive readout — set ANTHROPIC_API_KEY for a synthesized answer)",
    ].join("\n");
  }
}
