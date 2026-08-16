import { defineTool } from "eve/tools";
import { z } from "zod";
import { thirdMind } from "../lib/third-mind";

export default defineTool({
  description:
    "Search the shared Third-Mind memory layer for relevant observations by keyword. Returns ranked hits with their key, content, tags, and author.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Keywords to search for"),
    limit: z.number().int().min(1).max(50).optional().describe("Max hits (default 10)"),
  }),
  async execute({ query, limit }) {
    const hits = await thirdMind().search(query, limit ?? 10);
    return { query, count: hits.length, hits };
  },
});
