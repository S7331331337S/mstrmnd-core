// ============================================================
// NEXUS — Implementation
// ============================================================
// NEXUS is a special agent — it does not inherit the standard
// `deliberate()` flow because it does not deliberate on substance.
// It produces a QuorumPlan: which archetypes deliberate on this signal.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { persona, responsibility } from './persona';
import { env } from '@masterbrain/shared/env';
import type { Signal, QuorumPlan, ArchetypeId } from '@masterbrain/shared';

const ROUTING_PROMPT = `
You will receive a signal. Decide which council archetypes should deliberate.

The 12 council seats:
  capital:    allocator, strategist
  building:   architect, artisan, researcher
  operating:  steward, closer, grower
  network:    herald, connector, storyteller
  vision:     oracle

You may NEVER route to: orchestrator (you), elder, adversary. Those are auto-invoked.

Quorum sizing:
- low severity, narrow scope:     2–3 primary, 0–2 consulted
- medium severity:                3–5 primary, 1–3 consulted
- high or critical severity:      5–7 primary, 2–4 consulted

Return JSON, no preamble, no markdown fence:

{
  "primary":   ["archetype_id", ...],   // their voice is core to the outcome
  "consulted": ["archetype_id", ...],   // they weigh in if they have a position
  "reasoning": "One sentence on why this quorum, not another."
}
`.trim();

/**
 * The twelve seats NEXUS is allowed to route to. The meta roles — orchestrator,
 * elder and adversary — are auto-invoked at fixed phases and must never appear
 * in a quorum. HEX in particular extends Agent, so an un-filtered 'adversary'
 * in the routing output would make it deliberate twice.
 */
const ROUTABLE: ReadonlySet<string> = new Set<ArchetypeId>([
  'allocator', 'strategist',
  'architect', 'artisan', 'researcher',
  'steward', 'closer', 'grower',
  'herald', 'connector', 'storyteller',
  'oracle',
]);

export class Nexus {
  private client: Anthropic;
  readonly id = 'orchestrator' as const;
  readonly codename = 'NEXUS' as const;

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
   * Decide the quorum for a signal.
   */
  async route(signal: Signal): Promise<QuorumPlan> {
    const response = await this.client.messages.create({
      model: env.ROUTING_MODEL,
      max_tokens: 512,
      system: `${persona}\n\n## Your role\n${responsibility}\n\n${ROUTING_PROMPT}`,
      messages: [
        {
          role: 'user',
          content: [
            `# Signal`,
            `Kind: ${signal.kind}`,
            `Severity: ${signal.severity}`,
            signal.context ? `Context: ${signal.context}` : '',
            ``,
            `Payload:`,
            '```json',
            JSON.stringify(signal.payload, null, 2),
            '```',
            ``,
            `Return the routing JSON.`,
          ].filter(Boolean).join('\n'),
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return this.parseRoutingOutput(text);
  }

  /**
   * After deliberation + adversarial review, synthesize the decision.
   */
  async synthesize(args: {
    signal: Signal;
    deliberations: Array<{ archetype_id: ArchetypeId; position: string; confidence: number }>;
    adversaryPosition: string;
    priors: Array<{ pattern: string; confidence: number }>;
  }): Promise<{
    title: string;
    resolution: string;
    reasoning: string;
    dissent: string;
    confidence: number;
  }> {
    const SYNTHESIS_PROMPT = `
You are NEXUS, synthesizing the council's deliberation into a decision.

You will receive:
  - The original signal
  - Each council member's position
  - The adversary's strongest counter-argument (HEX)
  - Relevant priors from CANON

Your job:
  1. Write a TITLE for the decision (one line, specific, no jargon).
  2. Write the RESOLUTION — what the council decided. Active voice. Decisive.
  3. Write the REASONING — why this, drawing on the strongest deliberations and priors.
  4. Write the DISSENT — HEX's argument verbatim or restated, attached to the decision so future CANON can see what was overridden.
  5. Confidence: 0.0–1.0. Lower if council disagreement or weak priors.

Return JSON only, no markdown:
{
  "title": "...",
  "resolution": "...",
  "reasoning": "...",
  "dissent": "...",
  "confidence": 0.0
}
`.trim();

    const response = await this.client.messages.create({
      model: env.COUNCIL_MODEL, // synthesis is high-stakes, use opus
      max_tokens: 2048,
      system: `${persona}\n\n${SYNTHESIS_PROMPT}`,
      messages: [
        {
          role: 'user',
          content: [
            `# Signal: ${args.signal.kind}`,
            args.signal.context ?? '',
            ``,
            `# Deliberations`,
            ...args.deliberations.map(
              (d) => `**${d.archetype_id}** (conf ${d.confidence.toFixed(2)}): ${d.position}`
            ),
            ``,
            `# Adversary (HEX)`,
            args.adversaryPosition,
            ``,
            `# Priors (CANON)`,
            ...args.priors.map((p) => `- [${p.confidence.toFixed(2)}] ${p.pattern}`),
            ``,
            `Synthesize. Return JSON.`,
          ].join('\n'),
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return this.parseSynthesisOutput(text);
  }

  private parseRoutingOutput(raw: string): QuorumPlan {
    const json = this.extractJson(raw);
    const parsed = JSON.parse(json);

    // Validate rather than cast. An unrecognized id used to vanish silently when
    // the orchestrator looked it up in the council map, which meant a malformed
    // routing response could produce an empty quorum and a decision with no
    // deliberation behind it.
    const clean = (value: unknown, bucket: string): ArchetypeId[] => {
      if (!Array.isArray(value)) return [];
      const kept: ArchetypeId[] = [];
      for (const raw of value) {
        if (typeof raw !== 'string') continue;
        const id = raw.trim().toLowerCase();
        if (!ROUTABLE.has(id)) {
          console.warn(`[NEXUS] dropped unroutable archetype '${raw}' from ${bucket}`);
          continue;
        }
        if (!kept.includes(id as ArchetypeId)) kept.push(id as ArchetypeId);
      }
      return kept;
    };

    const primary = clean(parsed.primary, 'primary');
    const consulted = clean(parsed.consulted, 'consulted').filter((id) => !primary.includes(id));

    return { primary, consulted, reasoning: parsed.reasoning ?? '' };
  }

  private parseSynthesisOutput(raw: string) {
    const json = this.extractJson(raw);
    const parsed = JSON.parse(json);
    return {
      title: parsed.title,
      resolution: parsed.resolution,
      reasoning: parsed.reasoning,
      dissent: parsed.dissent,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
    };
  }

  private extractJson(raw: string): string {
    let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    return s;
  }
}
