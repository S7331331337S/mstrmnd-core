import { defineAgent } from "eve";
import { resolveModel } from "./lib/model";

/**
 * Maestro — the root orchestrator of the MSTRMND alliance.
 *
 * Model is resolved model-agnostically from the environment (AI Gateway in
 * production; xAI or Perplexity directly when a provider key is present).
 */
export default defineAgent({
  model: resolveModel(),
  reasoning: "low",
  // The active model may be a direct-provider model outside the AI Gateway
  // catalog (xAI Grok, Perplexity sonar), so set the context window explicitly.
  modelContextWindowTokens: 128_000,
});
