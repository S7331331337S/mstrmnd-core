import { defineTool } from "eve/tools";
import { z } from "zod";
import { thirdMind } from "../lib/third-mind";
import { scopeFromCtx } from "../lib/scope";

export default defineTool({
  description:
    "Read a single observation from the shared Third-Mind memory layer by its key or id.",
  inputSchema: z.object({
    idOrKey: z.string().min(1).describe("The observation key or id to read"),
  }),
  async execute({ idOrKey }, ctx) {
    const observation = await thirdMind().read(scopeFromCtx(ctx), idOrKey);
    if (!observation) return { found: false as const, idOrKey };
    return { found: true as const, observation };
  },
});
