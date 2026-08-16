import { defineTool } from "eve/tools";
import { z } from "zod";
import { thirdMind } from "../lib/third-mind";
import { scopeFromCtx } from "../lib/scope";

export default defineTool({
  description:
    "List the most recent observations in the shared Third-Mind memory layer, newest first.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)"),
  }),
  async execute({ limit }, ctx) {
    const rows = await thirdMind().list(scopeFromCtx(ctx), limit ?? 25);
    return { count: rows.length, observations: rows };
  },
});
