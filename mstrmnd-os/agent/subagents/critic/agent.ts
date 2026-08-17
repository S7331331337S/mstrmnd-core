import { defineAgent } from "eve";
import { resolveModel } from "../../lib/model";

export default defineAgent({
  description:
    "Adversarial reviewer. Pressure-tests a plan, draft, or decision; surfaces risks, failure modes, and weak assumptions; and returns a concrete, prioritized list of improvements.",
  model: resolveModel(),
  reasoning: "low",
  modelContextWindowTokens: 128_000,
});
