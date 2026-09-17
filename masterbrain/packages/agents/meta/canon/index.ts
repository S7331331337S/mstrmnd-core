// ============================================================
// CANON — Implementation
// ============================================================
// CANON is not a council agent — it doesn't deliberate.
// It is a retrieval + pattern-extraction service.
//
// Two primary jobs:
//   1. queryPriors(signal) → returns relevant patterns from history
//   2. ingestOutcome(decision, outcome) → updates the pattern store
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { env } from '@masterbrain/shared/env';
import type { Signal, CanonPrior, Decision } from '@masterbrain/shared';
import { supabase } from '@masterbrain/db';
import { persona, responsibility } from './persona';

const EMBEDDING_DIM = 1536;

export class Canon {
  private client: Anthropic;
  readonly id = 'elder' as const;
  readonly codename = 'CANON' as const;

  constructor() {
    this.client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      ...(env.AI_GATEWAY_API_KEY && {
        baseURL: env.AI_GATEWAY_BASE_URL,
        defaultHeaders: { 'x-api-key': env.AI_GATEWAY_API_KEY },
      }),
    });
  }

  /**
   * Given a new signal, surface relevant patterns from history.
   * Uses semantic search (pgvector) + recency + validation score.
   */
  async queryPriors(signal: Signal, opts: { topK?: number; minSimilarity?: number } = {}): Promise<CanonPrior[]> {
    const topK = opts.topK ?? 5;
    const minSimilarity = opts.minSimilarity ?? 0.7;

    const queryText = this.serializeSignal(signal);
    const embedding = await this.embed(queryText);

    // No embeddings provider configured — CANON has no way to judge relevance.
    // Return nothing rather than something arbitrary.
    if (!embedding) {
      console.warn('[CANON] no embeddings provider configured; deliberating without priors');
      return [];
    }

    // pgvector cosine similarity search via Supabase RPC
    const { data, error } = await supabase.rpc('match_canon_patterns', {
      query_embedding: embedding,
      match_threshold: minSimilarity,
      match_count: topK,
      signal_kinds: [signal.kind],
    });

    if (error) {
      console.error('[CANON] queryPriors error:', error);
      return [];
    }

    // Postgres `numeric` is serialized as a JSON string by PostgREST to preserve
    // precision. Coerce at the boundary — downstream code calls .toFixed() on these.
    return (data ?? []).map((row: {
      id: string;
      pattern: string;
      confidence: number | string;
      similarity: number | string;
      source_decisions: string[];
    }) => ({
      id: row.id,
      pattern: row.pattern,
      confidence: Number(row.confidence),
      similarity: Number(row.similarity),
      source_decisions: row.source_decisions ?? [],
    }));
  }

  /**
   * After an outcome is measured, extract patterns and update CANON.
   * This is what makes the system get smarter over time.
   */
  async ingestOutcome(args: {
    decision: Decision;
    outcomeVerdict: 'validated' | 'partial' | 'invalidated' | 'unknown';
    outcomeEvidence: string;
  }): Promise<{ patternsExtracted: number }> {
    // Ask the model to extract a generalizable pattern from this case
    const response = await this.client.messages.create({
      model: env.MEMORY_MODEL,
      max_tokens: 1024,
      system: `${persona}\n\n## Your role\n${responsibility}`,
      messages: [
        {
          role: 'user',
          content: [
            `A decision has been measured against reality.`,
            ``,
            `## Decision`,
            `Title: ${args.decision.title}`,
            `Resolution: ${args.decision.resolution}`,
            `Reasoning: ${args.decision.reasoning}`,
            `Recorded dissent (from HEX): ${args.decision.dissent}`,
            ``,
            `## Outcome`,
            `Verdict: ${args.outcomeVerdict}`,
            `Evidence: ${args.outcomeEvidence}`,
            ``,
            `## Your task`,
            `Extract 1-3 generalizable patterns from this case. A pattern has the shape:`,
            `"When [signal pattern], the council decided [action pattern], and reality returned [outcome pattern]."`,
            ``,
            `Be precise. Patterns must be transferable to future similar signals.`,
            `If the dissent was vindicated, surface that explicitly — that is the highest-value learning.`,
            ``,
            `Return JSON, no preamble:`,
            `{ "patterns": [{ "pattern": "...", "confidence": 0.0, "signal_kinds": ["..."] }, ...] }`,
          ].join('\n'),
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const parsed = this.extractJson(text);
    const patterns = (Array.isArray(parsed.patterns) ? parsed.patterns : []) as Array<{
      pattern: string;
      confidence: number;
      signal_kinds: string[];
    }>;

    // Persist each pattern. When no embeddings provider is configured the row is
    // still written with a null embedding — the learning is not lost, it is simply
    // not retrievable until embeddings are wired and the column is backfilled.
    for (const p of patterns) {
      const emb = await this.embed(p.pattern);
      const { error } = await supabase.from('canon_patterns').insert({
        pattern: p.pattern,
        signal_kinds: p.signal_kinds,
        source_decisions: [args.decision.id],
        confidence: p.confidence,
        embedding: emb,
      });
      if (error) console.error('[CANON] failed to persist pattern:', error);
    }

    return { patternsExtracted: patterns.length };
  }

  /**
   * Generate an embedding, or null when no embeddings provider is configured.
   *
   * There is deliberately no fallback. The previous placeholder summed character
   * codes into positional buckets, which makes similarity track text length and
   * character distribution rather than meaning — two signals with opposite
   * meaning scored 0.906 while two that meant the same thing scored 0.900, so
   * every pair cleared the 0.70 gate and ranking was arbitrary. Priors are
   * injected into all twelve council prompts as earned wisdom, so a wrong prior
   * is worse than no prior: it produces confident deliberation anchored to
   * unrelated history. Until a real provider is wired, CANON stays silent.
   */
  private async embed(text: string): Promise<number[] | null> {
    if (!env.EMBEDDINGS_PROVIDER || !env.EMBEDDINGS_API_KEY) return null;

    if (env.EMBEDDINGS_PROVIDER === 'voyage') {
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.EMBEDDINGS_API_KEY}`,
        },
        body: JSON.stringify({ input: [text], model: env.EMBEDDINGS_MODEL }),
      });
      if (!res.ok) throw new Error(`[CANON] embeddings failed: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
      return json.data[0]?.embedding ?? null;
    }

    if (env.EMBEDDINGS_PROVIDER === 'openai') {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.EMBEDDINGS_API_KEY}`,
        },
        body: JSON.stringify({ input: text, model: env.EMBEDDINGS_MODEL }),
      });
      if (!res.ok) throw new Error(`[CANON] embeddings failed: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
      return json.data[0]?.embedding ?? null;
    }

    throw new Error(`[CANON] unknown EMBEDDINGS_PROVIDER: ${env.EMBEDDINGS_PROVIDER}`);
  }

  private serializeSignal(signal: Signal): string {
    return [
      `kind=${signal.kind}`,
      `severity=${signal.severity}`,
      signal.context ?? '',
      JSON.stringify(signal.payload),
    ].join(' ');
  }

  private extractJson(raw: string): Record<string, unknown> {
    let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    return JSON.parse(s);
  }
}
