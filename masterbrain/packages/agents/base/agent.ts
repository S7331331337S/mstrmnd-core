// ============================================================
// @masterbrain/agents/base — The Agent base class
// ============================================================
// Every council member inherits from this. Defines the contract:
// take a signal + priors, return a structured deliberation.
//
// Personas live in each agent's folder. The base class owns
// invocation, schema validation, telemetry, and error handling.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type {
  ArchetypeId,
  AgentCodename,
  Layer,
  Signal,
  DeliberationOutput,
  CanonPrior,
} from '@masterbrain/shared';
import { env } from '@masterbrain/shared/env';
import { recordInvocation } from '@masterbrain/db';

export interface AgentDefinition {
  archetypeId: ArchetypeId;
  codename: AgentCodename;
  layer: Layer;
  persona: string;        // The agent's character/POV. Loaded from persona.ts
  responsibility: string; // One-line summary of what this agent owns
  model?: string;         // Override the council default if needed
}

export interface DeliberateInput {
  signal: Signal;
  priors: CanonPrior[];   // Patterns CANON surfaced as relevant
  peers?: Partial<Record<ArchetypeId, DeliberationOutput>>; // Other agents' positions (for late-round arbitration)
  context?: string;       // Pre-summarized context from NEXUS
}

// ----------------------------------------------------------------
// Output schema — every agent returns this shape
// ----------------------------------------------------------------
const DELIBERATION_SCHEMA = `
Return your response as JSON matching this exact shape — no preamble, no markdown fence:

{
  "position": "A clear, decisive statement of your position. 1-3 sentences. No hedging.",
  "confidence": 0.0,
  "reasoning": {
    "assumptions": ["The unstated assumptions this position depends on"],
    "evidence":    ["The evidence — from the signal, the priors, or domain knowledge — that supports it"],
    "tradeoffs":   ["What this position gives up. What breaks if you're wrong."]
  }
}
`.trim();

// ----------------------------------------------------------------
// The base class
// ----------------------------------------------------------------
export abstract class Agent {
  protected client: Anthropic;
  protected definition: AgentDefinition;

  constructor(definition: AgentDefinition) {
    this.definition = definition;
    this.client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      // Route through Vercel AI Gateway if configured (caching + observability)
      ...(env.AI_GATEWAY_API_KEY && {
        baseURL: env.AI_GATEWAY_BASE_URL,
        defaultHeaders: { 'x-api-key': env.AI_GATEWAY_API_KEY },
      }),
    });
  }

  /**
   * The primary method. Take a signal, produce a structured deliberation.
   * Subclasses can override `buildPrompt` to customize without rewriting invocation.
   */
  async deliberate(input: DeliberateInput): Promise<DeliberationOutput> {
    const started = Date.now();
    const prompt = this.buildPrompt(input);
    const model = this.definition.model ?? env.COUNCIL_MODEL;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 2048,
        system: this.systemPrompt(),
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const parsed = this.parseOutput(text);

      await recordInvocation({
        archetype_id: this.definition.archetypeId,
        tokens_in: response.usage.input_tokens,
        tokens_out: response.usage.output_tokens,
        latency_ms: Date.now() - started,
        model,
        succeeded: true,
      });

      return {
        archetype_id: this.definition.archetypeId,
        ...parsed,
      };
    } catch (err) {
      await recordInvocation({
        archetype_id: this.definition.archetypeId,
        latency_ms: Date.now() - started,
        model,
        succeeded: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * The agent's identity. Persona + responsibility + output discipline.
   */
  protected systemPrompt(): string {
    return [
      this.definition.persona,
      '',
      '## Your role',
      this.definition.responsibility,
      '',
      '## Output discipline',
      DELIBERATION_SCHEMA,
      '',
      '## Voice',
      '- Decisive. State a position, do not hedge.',
      '- Specific. Name numbers, names, dates when relevant.',
      '- Honest about uncertainty. Lower confidence is fine; vague language is not.',
      '- You speak from your archetype, not as a neutral observer.',
    ].join('\n');
  }

  /**
   * Builds the user-turn prompt for a single deliberation.
   * Subclasses may override (HEX does — it inverts the framing).
   */
  protected buildPrompt(input: DeliberateInput): string {
    const parts: string[] = [];

    parts.push('# Signal');
    parts.push(`Kind: ${input.signal.kind}`);
    parts.push(`Severity: ${input.signal.severity}`);
    if (input.signal.context) {
      parts.push(`\nContext: ${input.signal.context}`);
    }
    parts.push('\nPayload:');
    parts.push('```json');
    parts.push(JSON.stringify(input.signal.payload, null, 2));
    parts.push('```');

    if (input.priors.length > 0) {
      parts.push('\n# Priors from CANON');
      parts.push('Patterns from prior decisions that may apply. Use them. They were earned.');
      for (const p of input.priors) {
        parts.push(`- [confidence ${p.confidence.toFixed(2)}, similarity ${p.similarity.toFixed(2)}] ${p.pattern}`);
      }
    }

    if (input.peers && Object.keys(input.peers).length > 0) {
      parts.push('\n# Peer positions');
      parts.push('Other council members have already weighed in. Engage with them — agree, refine, or disagree explicitly.');
      for (const [id, peer] of Object.entries(input.peers)) {
        if (peer) parts.push(`- **${id}** (conf ${peer.confidence.toFixed(2)}): ${peer.position}`);
      }
    }

    parts.push('\n# Your deliberation');
    parts.push('Speak from your archetype. Return the JSON. Nothing else.');

    return parts.join('\n');
  }

  /**
   * Parse and validate the model's structured output.
   * Falls back to extracting JSON from prose if the model added preamble.
   */
  protected parseOutput(raw: string): Omit<DeliberationOutput, 'archetype_id'> {
    let json = raw.trim();

    // Strip code fences if present
    json = json.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

    // If there's prose before the JSON, try to extract the object
    const firstBrace = json.indexOf('{');
    const lastBrace = json.lastIndexOf('}');
    if (firstBrace > 0 && lastBrace > firstBrace) {
      json = json.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(json);

    // Light validation — fail loud if the model misbehaved
    if (typeof parsed.position !== 'string') throw new Error(`${this.definition.codename}: missing 'position'`);
    if (typeof parsed.confidence !== 'number') throw new Error(`${this.definition.codename}: missing 'confidence'`);
    if (!parsed.reasoning) throw new Error(`${this.definition.codename}: missing 'reasoning'`);

    return {
      position: parsed.position,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      reasoning: {
        assumptions: parsed.reasoning.assumptions ?? [],
        evidence:    parsed.reasoning.evidence    ?? [],
        tradeoffs:   parsed.reasoning.tradeoffs   ?? [],
      },
    };
  }

  get id(): ArchetypeId { return this.definition.archetypeId; }
  get codename(): AgentCodename { return this.definition.codename; }
  get layer(): Layer { return this.definition.layer; }
}
