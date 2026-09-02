import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { callVgpuMcpTool } from "../lib/vgpu-mcp";

/**
 * Search and read canonical vgpu WebGPU documentation.
 * Backed by the public MCP at vgpu.sh (modern 2026-07-28 HTTP).
 */
export default defineTool({
  description:
    "Search, resolve, list, grep, and read vgpu WebGPU documentation (shaders, pipelines, canvas, headless Node/Dawn, WGSL). Prefer this over generic web search for vgpu APIs. Read-only. Requires human approval.",
  approval: always(),
  inputSchema: z.discriminatedUnion("operation", [
    z.object({
      operation: z.literal("search"),
      query: z.string().min(1).max(200).describe("Concept or API to find"),
    }),
    z.object({
      operation: z.literal("read"),
      target: z.string().min(1).max(512).describe("Document path or symbol to read"),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(65536).optional(),
    }),
    z.object({
      operation: z.literal("resolve"),
      target: z.string().min(1).max(512).describe("Symbol or documentation target"),
    }),
    z.object({
      operation: z.literal("list"),
      path: z.string().min(1).max(512).optional().describe("Virtual docs path (default /)"),
    }),
    z.object({
      operation: z.literal("grep"),
      pattern: z.string().min(1).max(200),
      ignoreCase: z.boolean().optional(),
      package: z.string().min(1).max(128).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    z.object({
      operation: z.literal("symbols"),
      query: z.string().min(1).max(200).optional(),
      package: z.string().min(1).max(128).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  ]),
  async execute(input, ctx) {
    return callVgpuMcpTool("docs", input, ctx.abortSignal);
  },
});
