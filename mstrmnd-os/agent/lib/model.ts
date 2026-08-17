import { createXai } from "@ai-sdk/xai";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway, type LanguageModel } from "ai";

/** Vercel AI Gateway key, accepting either env var name. */
function gatewayKey(): string | undefined {
  return process.env.AI_GATEWAY_API_KEY ?? process.env.AI_GATEWAY;
}

function gatewayModel(id: string): LanguageModel {
  return createGateway({ apiKey: gatewayKey() })(id);
}

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
    return gatewayModel(process.env.MSTRMND_MODEL ?? "xai/grok-4");
  }
  if (provider === "openai") {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
      process.env.MSTRMND_MODEL ?? "gpt-4o",
    );
  }
  if (provider === "anthropic") {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(
      process.env.MSTRMND_MODEL ?? "claude-3-5-sonnet-latest",
    );
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

  // Default precedence — prefer tool-capable providers for the agent loop.
  if (gatewayKey()) {
    return gatewayModel(process.env.MSTRMND_MODEL ?? "xai/grok-4");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(
      process.env.MSTRMND_MODEL ?? "claude-3-5-sonnet-latest",
    );
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
      process.env.MSTRMND_MODEL ?? "gpt-4o",
    );
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

  // Nothing configured: build a Gateway model so the failure is a clear
  // "missing credential" at request time rather than a silent default.
  return gatewayModel(process.env.MSTRMND_MODEL ?? "xai/grok-4");
}

/** Human-readable label for the active provider (for UI / status surfaces). */
export function activeProviderLabel(): string {
  const p = process.env.MSTRMND_PROVIDER?.toLowerCase();
  if (p) return p;
  if (gatewayKey()) return "gateway";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.XAI_TOKEN) return "xai";
  if (process.env.PERPLEXITY_API_TOKEN) return "perplexity";
  return "gateway";
}
