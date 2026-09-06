# @mstrmnd/vgpu-app

Standalone Vite + React WebGPU starter, set up with the official [`npx vgpu`](https://vgpu.sh) CLI.

The shader and renderer are the verified **gradient** gallery example:

```bash
npx vgpu examples pull gradient --out src/example
```

Page chrome is platinum `#e8e2d0` over obsidian `#0a0a0b`. The pulled shader is unchanged.

## Commands (from repo root)

```bash
pnpm --filter @mstrmnd/vgpu-app dev
pnpm --filter @mstrmnd/vgpu-app typecheck
pnpm --filter @mstrmnd/vgpu-app test
pnpm --filter @mstrmnd/vgpu-app check
pnpm --filter @mstrmnd/vgpu-app build
```

`check` runs `vgpu check` on `src/example/shader.wgsl`. `test` resolves that file with `resolveShader()` (no GPU). `render` draws a 160×90 PNG through `vgpu/node` when this machine has a WebGPU device:

```bash
npx vgpu doctor
npx vgpu install-software-renderer   # only if doctor asks for it
pnpm --filter @mstrmnd/vgpu-app render
```

## Agent workflow

```bash
npx vgpu
npx vgpu docs cat getting-started.md
npx vgpu examples search gradient
```
