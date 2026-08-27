import { defineTool } from "eve/tools";
import { z } from "zod";
import { callVgpuMcpTool } from "../lib/vgpu-mcp";

/**
 * Search and read verified vgpu examples. Hosted HTTP is read-only —
 * it does not download or execute example code.
 */
export default defineTool({
  description:
    "Search, inspect, and read verified vgpu WebGPU examples (browser canvas, headless Node). Use search then show then read. Read-only; does not execute code.",
  inputSchema: z.discriminatedUnion("operation", [
    z.object({
      operation: z.literal("search"),
      query: z.string().min(1).max(200).describe("Topic to find examples for"),
      match: z.enum(["all", "any"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      revision: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional()
        .describe("Optional SHA-256 example revision pin"),
    }),
    z.object({
      operation: z.literal("show"),
      id: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9][a-z0-9-]*$/)
        .describe("Example id from search"),
      revision: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    }),
    z.object({
      operation: z.literal("read"),
      id: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9][a-z0-9-]*$/),
      path: z.string().min(1).max(1024).describe("File path inside the example"),
      revision: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(65536).optional(),
    }),
  ]),
  async execute(input, ctx) {
    return callVgpuMcpTool("examples", input, ctx.abortSignal);
  },
});
