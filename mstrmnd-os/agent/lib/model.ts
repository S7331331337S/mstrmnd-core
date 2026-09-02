import { createXai } from "@ai-sdk/xai";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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
 * Base URL of a self-operated, OpenAI-compatible gateway (LiteLLM, Portkey,
 * vLLM, Ollama, an internal proxy). Its presence is what makes the Vercel AI
 * Gateway a swappable adapter rather than a dependency: set this and no model
 * traffic leaves infrastructure we run.
 */
function compatibleBaseUrl(): string | undefined {
  return process.env.MSTRMND_MODEL_BASE_URL;
}

function compatibleModel(id: string): LanguageModel {
  return createOpenAICompatible({
    name: process.env.MSTRMND_MODEL_GATEWAY_NAME ?? "mstrmnd-gateway",
    baseURL: compatibleBaseUrl() ?? "",
    apiKey: process.env.MSTRMND_MODEL_API_KEY,
  })(id);
}

/**
 * Model resolution is model-agnostic and decided at the edge from the
 * environment, never hard-coded into domain logic:
 *
 *   MSTRMND_PROVIDER = compatible | gateway | anthropic | openai | xai | perplexity
 *
 * Default precedence when MSTRMND_PROVIDER is unset:
 *   1. Self-hosted gateway — `MSTRMND_MODEL_BASE_URL` set (OpenAI-compatible:
 *      LiteLLM, Portkey, vLLM, Ollama). Takes precedence so a host we operate
 *      always wins over a vendor-operated one.
 *   2. AI Gateway  — `AI_GATEWAY_API_KEY` set (grok via string id)
 *   3. Anthropic / OpenAI / xAI direct — their key set
 *   4. Perplexity  — `PERPLEXITY_API_TOKEN` set (offline-credential demo fallback)
 *
 * `MSTRMND_MODEL` overrides the concrete model id for the selected provider.
 */
export type ModelHint = "fast" | "balanced" | "capable";

function modelId(fallback: string, override?: string): string {
  return override ?? process.env.MSTRMND_MODEL ?? fallback;
}

/** Map a Board quality hint to a model id. Vendor names stay in env, not in the app. */
export function modelIdForHint(hint?: ModelHint): string | undefined {
  if (hint === "fast") return process.env.MSTRMND_MODEL_FAST ?? process.env.MSTRMND_MODEL;
  if (hint === "capable") return process.env.MSTRMND_MODEL_CAPABLE ?? process.env.MSTRMND_MODEL;
  if (hint === "balanced") return process.env.MSTRMND_MODEL;
  return undefined;
}

export function resolveModel(overrideId?: string): LanguageModel | string {
  const provider = process.env.MSTRMND_PROVIDER?.toLowerCase();

  if (provider === "compatible") {
    return compatibleModel(modelId("gpt-4o", overrideId));
  }
  if (provider === "gateway") {
    return gatewayModel(modelId("xai/grok-4", overrideId));
  }
  if (provider === "openai") {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
      modelId("gpt-4o", overrideId),
    );
  }
  if (provider === "anthropic") {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(
      modelId("claude-3-5-sonnet-latest", overrideId),
    );
  }
  if (provider === "perplexity") {
    return createPerplexity({ apiKey: process.env.PERPLEXITY_API_TOKEN })(
      modelId("sonar", overrideId),
    );
  }
  if (provider === "xai") {
    return createXai({ apiKey: process.env.XAI_TOKEN })(
      modelId("grok-4", overrideId),
    );
  }

  // Default precedence — prefer tool-capable providers for the agent loop,
  // and a gateway we operate over one a vendor operates.
  if (compatibleBaseUrl()) {
    return compatibleModel(modelId("gpt-4o", overrideId));
  }
  if (gatewayKey()) {
    return gatewayModel(modelId("xai/grok-4", overrideId));
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(
      modelId("claude-3-5-sonnet-latest", overrideId),
    );
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
      modelId("gpt-4o", overrideId),
    );
  }
  if (process.env.XAI_TOKEN) {
    return createXai({ apiKey: process.env.XAI_TOKEN })(
      modelId("grok-4", overrideId),
    );
  }
  if (process.env.PERPLEXITY_API_TOKEN) {
    return createPerplexity({ apiKey: process.env.PERPLEXITY_API_TOKEN })(
      modelId("sonar", overrideId),
    );
  }

  // Nothing configured: build a Gateway model so the failure is a clear
  // "missing credential" at request time rather than a silent default.
  return gatewayModel(modelId("xai/grok-4", overrideId));
}

/** Human-readable label for the active provider (for UI / status surfaces). */
export function activeProviderLabel(): string {
  const p = process.env.MSTRMND_PROVIDER?.toLowerCase();
  if (p) return p;
  if (compatibleBaseUrl()) return "compatible";
  if (gatewayKey()) return "gateway";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.XAI_TOKEN) return "xai";
  if (process.env.PERPLEXITY_API_TOKEN) return "perplexity";
  return "gateway";
}
