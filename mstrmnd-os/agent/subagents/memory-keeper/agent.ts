import { defineAgent } from "eve";
import { resolveModel } from "../../lib/model";

export default defineAgent({
  description:
    "Curator of the Third-Mind. Decides what is worth remembering, writes durable, well-tagged observations, and can recall prior context on request. Delegate here to persist decisions, constraints, and results.",
  model: resolveModel(),
  reasoning: "low",
  modelContextWindowTokens: 128_000,
});
