# MSTRMND OS

**Multi-Agent Mastermind OS** — a private alliance of specialized minds that is
continuous, coordinated, and built to execute. Built on the Vercel AI stack with
Next.js 16.3 as the host application and UI surface.

> MSTRMND installs the intelligence layer between a company's vision and its
> daily execution. Models are interchangeable execution resources; the alliance,
> its memory, and its coordination are what persist.

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Next.js 16.3 (App Router) | Host app + UI, `withEve` + `withWorkflow` |
| Agent runtime | [`eve`](https://eve.dev) | Filesystem agents, durable sessions, subagents, skills, tools, channels |
| Models | AI Gateway + AI SDK (`ai`) | Provider-agnostic model access via string IDs or direct providers |
| Durability | Workflow SDK (`workflow`) | Checkpointed, resumable multi-agent patterns |
| Execution | Vercel Sandbox | Isolated microVMs for untrusted code (`execute_code`) |
| Memory | Third-Mind | Shared observation layer read/written by agents via tools |

## Architecture

```
Next.js 16.3 (Swiss / dark / Geist)
  • Alliance command UI (useEveAgent)   • Third-Mind view   • Agents dashboard
        │ same-origin /eve/v1/*
eve runtime (agent/)
  • Maestro (root orchestrator)
  • Subagents: Researcher · Critic · Memory-Keeper
  • Tools: memory_{read,write,search,list} · execute_code (Sandbox)
  • Skills (Markdown playbooks) · Sessions → Workflows
        │                                   │
   AI Gateway / AI SDK               Vercel Sandbox
        │
   Third-Mind (shared memory: file-backed in dev, Neon/Blob in prod)
```

## Quick start

Requires **Node.js >= 24** and pnpm.

```bash
pnpm install
pnpm dev            # Next.js + eve dev server (http://localhost:3000)
```

### Model provider

Model access is resolved model-agnostically in `agent/lib/model.ts`:

- `MSTRMND_PROVIDER` = `gateway` | `xai` | `perplexity` (explicit), else the
  default precedence is Gateway → xAI → Perplexity based on which credential is
  present.
- `MSTRMND_MODEL` overrides the concrete model id.

Production default is the Vercel AI Gateway — set `AI_GATEWAY_API_KEY` or link a
Vercel project (`eve link`) for OIDC. To run a specific provider directly, set
its key (`XAI_TOKEN`, `PERPLEXITY_API_TOKEN`, …) and select it with
`MSTRMND_PROVIDER`.

```bash
MSTRMND_PROVIDER=perplexity pnpm dev
```

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js + eve dev server |
| `pnpm eve:info` | Inspect the discovered agent surface |
| `pnpm test:memory` | Offline Third-Mind round-trip test |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | Production build |

## Slice status

This is **Slice 1 — scaffold + Maestro core + Third-Mind + Alliance UI**:

- Maestro root orchestrator with Researcher / Critic / Memory-Keeper subagents.
- Third-Mind shared memory with `memory_{read,write,search,list}` tools, a
  durable file-backed store, and an interactive dashboard.
- Swiss/dark Alliance command UI streaming live Maestro turns via `useEveAgent`.
- `withEve(withWorkflow(...))` composed; a `parallel-council` workflow pattern.
- Approval-gated `execute_code` (Vercel Sandbox) scaffolded.

Next slices: production memory adapter (Neon + vectors); binding workflow steps
to real subagents (Orchestrator-Worker, Evaluator-Loop); sandbox execution;
Slack/cron channels; evals.

### Notes & limits

- The sandbox-backed built-in tools (`bash`, file tools) are disabled in favor
  of the approval-gated `execute_code`; enabling them is the execution slice.
- Live tool-calling and subagent delegation need a tool-capable model with
  credits (xAI/Gateway); the Perplexity fallback streams text but does not call
  tools.
