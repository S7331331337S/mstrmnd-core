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
    (Vercel Sandbox), and `disableTool()` stubs for the sandbox-backed builtins.
  - `subagents/{researcher,critic,memory-keeper}/` — specialists.
  - `skills/` — Markdown playbooks loaded on demand.
- `workflows/` — durable Workflow SDK patterns (`"use workflow"`).
- `app/` — Next.js App Router UI (Alliance command, Third-Mind, Agents).
- `next.config.ts` — `withEve(withWorkflow(...))`.

## Model access (model-agnostic)

Resolved in `agent/lib/model.ts`. Set `MSTRMND_PROVIDER` = `gateway` | `xai` |
`perplexity`, or rely on the default precedence (Gateway → xAI → Perplexity).
`MSTRMND_MODEL` overrides the concrete model id. Production default is the AI
Gateway (`AI_GATEWAY_API_KEY` or a linked Vercel project's OIDC).

## Commands

- `pnpm dev` — Next.js + eve dev server together.
- `pnpm eve:info` — inspect discovered agent surface (run when discovery is off).
- `pnpm test:memory` — offline Third-Mind round-trip test.
- `pnpm build` / `pnpm eve:build` — production builds.

## Notes

- Brand: ONE accent — Platinum `#e8e2d0` over obsidian `#0a0a0b`. No second hue.
- Human approval is a hard stop for consequential actions (`execute_code` is
  approval-gated).
- Third-Mind is file-backed for dev/CI; the production adapter (Neon/Postgres +
  vectors, or Blob) is the dedicated memory-layer slice.
