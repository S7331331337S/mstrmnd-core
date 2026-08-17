import { defineAgent } from "eve";
import { resolveModel } from "../../lib/model";

export default defineAgent({
  description:
    "Deep research and source synthesis. Investigates ambiguous questions, gathers evidence, flags uncertainty, and returns a structured evidence brief. Use before the alliance commits to a plan.",
  model: resolveModel(),
  reasoning: "low",
  modelContextWindowTokens: 128_000,
});
