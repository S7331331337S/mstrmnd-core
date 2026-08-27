import { defineMcpClientConnection } from "eve/connections";

/**
 * vgpu — public WebGPU docs + verified-examples MCP.
 *
 * The hosted server at vgpu.sh is read-only and needs no auth. Point this at a
 * local `npx vgpu mcp` process with `MSTRMND_VGPU_MCP_URL` when you want
 * package-versioned docs or scoped example downloads instead of the public
 * endpoint. Domain code never imports the `vgpu` package; this connection is
 * the only seam.
 *
 * Remote tools: `docs` (search / resolve / list / grep / symbols / read) and
 * `examples` (search / show / read). Hosted HTTP never writes to disk.
 *
 * @see https://vgpu.sh/docs/mcp
 * @see docs/portability.md
 */
const url = process.env.MSTRMND_VGPU_MCP_URL ?? "https://vgpu.sh/api/mcp";

export default defineMcpClientConnection({
  url,
  description:
    "vgpu WebGPU library: search and read documentation, resolve API symbols, and inspect verified examples (browser canvas, headless Node/Dawn, WGSL modules). Use for shaders, GPU pipelines, compute, and canvas rendering. Read-only; does not execute example code.",
  tools: { allow: ["docs", "examples"] },
});
