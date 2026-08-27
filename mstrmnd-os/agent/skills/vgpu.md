---
name: vgpu
description: Load when writing or debugging WebGPU, WGSL shaders, canvas GPU rendering, or vgpu library code. Prefer the vgpu MCP connection over general web search.
---

# vgpu

vgpu is a small, composable WebGPU library — one API for browser canvases and
headless Node (Dawn), with WGSL modules imported like TypeScript.

Docs and verified examples live behind the **vgpu** MCP connection
(`agent/connections/vgpu.ts`). Do not invent API shapes from memory.

## When to use

- Rendering to a canvas, or headless through Dawn in Node
- Importing / composing `.wgsl` shader modules
- Looking up `init`, `draw`, `compute`, `effect`, `frame`, `target`, uniforms
- Finding a verified example to copy from rather than writing a pipeline cold

## How

1. Search docs (`vgpu` connection, `docs` / `search` or `resolve`) for the
   symbol or concept.
2. Read the matching guide or API page (`docs` / `read`).
3. If you need a working starting point, search examples, then `show` the
   manifest and `read` individual files.
4. Do not download or execute example code through this connection — hosted
   HTTP is read-only. Sandbox execution stays on `execute_code` after approval.

## Do not

- Guess WGSL binding layouts, buffer formats, or vgpu free-function signatures.
- Use generic web search for vgpu APIs when the connection is available.
- Import a vendor GPU SDK inside tools or domain code. The MCP connection is
  the adapter; local docs are `npx vgpu mcp` via `MSTRMND_VGPU_MCP_URL`.
