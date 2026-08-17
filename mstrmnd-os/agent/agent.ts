import { defineAgent } from "eve";
import { resolveModel } from "./lib/model";

/**
 * Maestro — the root orchestrator of the MSTRMND alliance.
 *
 * Model is resolved model-agnostically from the environment (a self-hosted
 * OpenAI-compatible gateway, the Vercel AI Gateway, or a direct provider).
 *
 * Durability is likewise an adapter. `MSTRMND_WORKFLOW_WORLD` names a Workflow
 * world package that backs sessions, runs, queueing, and streaming; leaving it
 * unset uses eve's file-backed local world (`.eve/.workflow-data`), which is
 * what a self-hosted container mounts on a persistent volume. The value is read
 * when the agent is compiled, so it belongs in the build environment.
 */
const workflowWorld = process.env.MSTRMND_WORKFLOW_WORLD;

export default defineAgent({
  model: resolveModel(),
  reasoning: "low",
  // The active model may be a direct-provider model outside the AI Gateway
  // catalog (xAI Grok, Perplexity sonar), so set the context window explicitly.
  modelContextWindowTokens: 128_000,
  ...(workflowWorld
    ? { experimental: { workflow: { world: workflowWorld } } }
    : {}),
});
