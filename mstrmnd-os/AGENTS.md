<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MSTRMND OS — agent guide

Multi-Agent Mastermind OS on the Vercel AI stack. Next.js 16.3 hosts the UI and
mounts the **eve** agent runtime same-origin at `/eve/v1/*`.

## Requirements

- **Node.js >= 24** (eve requires it). Use pnpm.

## Layout

- `agent/` — the eve agent (filesystem-first).
  - `agent.ts` + `instructions.md` — Maestro, the root orchestrator.
  - `lib/model.ts` — model-agnostic provider resolution from env.
  - `lib/third-mind.ts` — the shared Third-Mind memory store + interface.
  - `tools/` — `memory_{write,read,search,list}`, approval-gated `execute_code`
    (sandbox), `vgpu_docs` / `vgpu_examples` (read-only WebGPU MCP at
    [vgpu.sh](https://vgpu.sh); URL via `MSTRMND_VGPU_MCP_URL`), and
    `disableTool()` stubs for the sandbox-backed builtins.
  - `subagents/{researcher,critic,memory-keeper}/` — specialists.
  - `skills/` — Markdown playbooks loaded on demand (`vgpu` for WebGPU/WGSL).
  - `sandbox.ts` — sandbox backend adapter (`MSTRMND_SANDBOX`).
- `workflows/` — durable Workflow SDK patterns (`"use workflow"`).
- `app/` — Next.js App Router UI (Alliance command, Third-Mind, Agents).
- `next.config.ts` — `withEve(withWorkflow(...))`; standalone output off Vercel.
- `Dockerfile` — self-hosted image (see `../docs/portability.md`).

## Model access (model-agnostic)

Resolved in `agent/lib/model.ts`. Set `MSTRMND_PROVIDER` = `compatible` |
`gateway` | `anthropic` | `openai` | `xai` | `perplexity`, or rely on the default
precedence: a self-hosted OpenAI-compatible gateway (`MSTRMND_MODEL_BASE_URL` —
LiteLLM, Portkey, vLLM, Ollama) → AI Gateway → Anthropic → OpenAI → xAI →
Perplexity. `MSTRMND_MODEL` overrides the concrete model id.

## Host portability

Hosting is an adapter, not a dependency. Vercel is one target; the same source
builds a plain Node container.

- `agent/sandbox.ts` — `MSTRMND_SANDBOX` = `auto` | `vercel` | `docker` |
  `microsandbox` | `justbash`; egress is `deny-all` by default
  (`MSTRMND_SANDBOX_NETWORK`).
- `agent/agent.ts` — `MSTRMND_WORKFLOW_WORLD` binds durability to a Workflow
  world package; unset uses eve's file-backed world under `.eve/`. Read at
  **build** time.
- `next.config.ts` — `output: "standalone"` off Vercel (`MSTRMND_STANDALONE`).
- **Tools must call `ctx.getSandbox()`**, never a vendor sandbox SDK. Full ledger
  and exit plan: [`../docs/portability.md`](../docs/portability.md).

## Commands

- `pnpm dev` — Next.js + eve dev server together.
- `pnpm eve:info` — inspect discovered agent surface (run when discovery is off).
- `pnpm test:memory` — offline Third-Mind round-trip test.
- `pnpm build` / `pnpm eve:build` — production builds.
- `docker build -t mstrmnd-os .` — self-hosted image; or
  `docker compose -f ../infrastructure/docker-compose.self-host.yml up --build`
  for the whole stack (app + durable state + Postgres) off-platform.

## Notes

- Brand: ONE accent — Platinum `#e8e2d0` over obsidian `#0a0a0b`. No second hue.
- Human approval is a hard stop for consequential actions (`execute_code` is
  approval-gated).
- Third-Mind is file-backed for dev/CI; the production adapter (Neon/Postgres +
  vectors, or Blob) is the dedicated memory-layer slice.
