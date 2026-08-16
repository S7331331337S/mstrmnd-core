import { defineTool } from "eve/tools";
import { z } from "zod";
import { thirdMind } from "../lib/third-mind";
import { scopeFromCtx, agentFromCtx } from "../lib/scope";

export default defineTool({
  description:
    "Write a durable observation into the shared Third-Mind memory layer. Use a stable key so later writes to the same key update it. Keep content concise and self-contained.",
  inputSchema: z.object({
    key: z.string().min(1).describe("Stable identifier for this observation"),
    content: z.string().min(1).describe("The observation, self-contained"),
    tags: z.array(z.string()).optional().describe("Optional topical tags"),
  }),
  async execute({ key, content, tags }, ctx) {
    const observation = await thirdMind().write({
      scope: scopeFromCtx(ctx),
      key,
      content,
      tags,
      agent: agentFromCtx(ctx, "maestro"),
    });
    return { ok: true, id: observation.id, key: observation.key };
  },
});
