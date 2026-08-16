import { defineTool } from "eve/tools";
import { z } from "zod";
import { thirdMind } from "../lib/third-mind";

export default defineTool({
  description:
    "Write a durable observation into the shared Third-Mind memory layer. Use a stable key so later writes to the same key update it. Keep content concise and self-contained.",
  inputSchema: z.object({
    key: z.string().min(1).describe("Stable identifier for this observation"),
    content: z.string().min(1).describe("The observation, self-contained"),
    tags: z.array(z.string()).optional().describe("Optional topical tags"),
  }),
  async execute({ key, content, tags }, ctx) {
    const agentName =
      (ctx as { session?: { agent?: { name?: string } } }).session?.agent?.name ??
      "maestro";
    const observation = await thirdMind().write({
      key,
      content,
      tags,
      agent: agentName,
    });
    return { ok: true, id: observation.id, key: observation.key };
  },
});
