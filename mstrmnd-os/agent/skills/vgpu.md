---
name: vgpu
description: Load when writing or debugging WebGPU, WGSL shaders, canvas GPU rendering, or vgpu library code. Prefer vgpu_docs and vgpu_examples over general web search.
---

# vgpu

vgpu is a small, composable WebGPU library — one API for browser canvases and
headless Node (Dawn), with WGSL modules imported like TypeScript.

Docs and verified examples are `vgpu_docs` and `vgpu_examples` (adapter in
`agent/lib/vgpu-mcp.ts`). Do not invent API shapes from memory.

## When to use

- Rendering to a canvas, or headless through Dawn in Node
- Importing / composing `.wgsl` shader modules
- Looking up `init`, `draw`, `compute`, `effect`, `frame`, `target`, uniforms
- Finding a verified example to copy from rather than writing a pipeline cold

## How

1. `vgpu_docs` with `operation: "search"` or `"resolve"` for the symbol.
2. `vgpu_docs` with `operation: "read"` on the matching guide or API page.
3. If you need a working starting point, `vgpu_examples` `search`, then `show`
   the manifest, then `read` individual files.
4. Do not download or execute example code through these tools — hosted HTTP
   is read-only. Sandbox execution stays on `execute_code` after approval.

## Do not

- Guess WGSL binding layouts, buffer formats, or vgpu free-function signatures.
- Use generic web search for vgpu APIs when these tools are available.
- Import a vendor GPU SDK inside tools or domain code. The MCP HTTP adapter
  is the seam; local docs are `npx vgpu mcp` via `MSTRMND_VGPU_MCP_URL`.
