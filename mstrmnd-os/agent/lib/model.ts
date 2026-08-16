import { createXai } from "@ai-sdk/xai";
import { createPerplexity } from "@ai-sdk/perplexity";
import type { LanguageModel } from "ai";

/**
 * Model resolution is model-agnostic and decided at the edge from the
 * environment, never hard-coded into domain logic:
 *
 *   MSTRMND_PROVIDER = gateway | xai | perplexity   (explicit override)
 *
 * Default precedence when MSTRMND_PROVIDER is unset:
 *   1. AI Gateway  — `AI_GATEWAY_API_KEY` set (production default; grok via string id)
 *   2. xAI direct  — `XAI_TOKEN` set
 *   3. Perplexity  — `PERPLEXITY_API_TOKEN` set (offline-credential demo fallback)
 *
 * `MSTRMND_MODEL` overrides the concrete model id for the selected provider.
 */
export function resolveModel(): LanguageModel | string {
  const provider = process.env.MSTRMND_PROVIDER?.toLowerCase();

  if (provider === "gateway") {
    return process.env.MSTRMND_MODEL ?? "xai/grok-4";
  }
  if (provider === "perplexity") {
    return createPerplexity({ apiKey: process.env.PERPLEXITY_API_TOKEN })(
      process.env.MSTRMND_MODEL ?? "sonar",
    );
  }
  if (provider === "xai") {
    return createXai({ apiKey: process.env.XAI_TOKEN })(
      process.env.MSTRMND_MODEL ?? "grok-4",
    );
  }

  if (process.env.AI_GATEWAY_API_KEY) {
    return process.env.MSTRMND_MODEL ?? "xai/grok-4";
  }
  if (process.env.XAI_TOKEN) {
    return createXai({ apiKey: process.env.XAI_TOKEN })(
      process.env.MSTRMND_MODEL ?? "grok-4",
    );
  }
  if (process.env.PERPLEXITY_API_TOKEN) {
    return createPerplexity({ apiKey: process.env.PERPLEXITY_API_TOKEN })(
      process.env.MSTRMND_MODEL ?? "sonar",
    );
  }

  // Nothing configured: fall back to a Gateway string so the failure is a
  // clear "missing credential" at request time rather than a silent default.
  return process.env.MSTRMND_MODEL ?? "xai/grok-4";
}

/** Human-readable label for the active provider (for UI / status surfaces). */
export function activeProviderLabel(): string {
  const p = process.env.MSTRMND_PROVIDER?.toLowerCase();
  if (p) return p;
  if (process.env.AI_GATEWAY_API_KEY) return "gateway";
  if (process.env.XAI_TOKEN) return "xai";
  if (process.env.PERPLEXITY_API_TOKEN) return "perplexity";
  return "gateway";
}
