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
| Durability | Workflow SDK (`workflow`) | Checkpointed, resumable multi-agent patterns; world selectable |
| Execution | Sandbox adapter (`agent/sandbox.ts`) | Vercel Sandbox, Docker, microsandbox, or just-bash — same `/workspace` |
| Auth | Session (JWT via `jose`) | Sign in / sign up; gates the app **and** the agent; per-workspace scope |
| Data | Postgres / Neon (`pg`) | Users + Third-Mind persist in Postgres when `DATABASE_URL` is set (file fallback otherwise) |
| Memory | Third-Mind | Multi-tenant shared observation layer, read/written by agents via tools |

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

- `MSTRMND_PROVIDER` = `compatible` | `gateway` | `anthropic` | `openai` | `xai` |
  `perplexity` (explicit), else the default precedence is self-hosted gateway →
  AI Gateway → Anthropic → OpenAI → xAI → Perplexity, based on which credential
  is present.
- `MSTRMND_MODEL` overrides the concrete model id.

Set `MSTRMND_MODEL_BASE_URL` (plus `MSTRMND_MODEL_API_KEY`) to route through an
OpenAI-compatible gateway you operate — LiteLLM, Portkey, vLLM, Ollama — and no
model traffic touches a vendor gateway. It deliberately outranks the Vercel AI
Gateway, which stays the convenient default when nothing self-hosted is
configured (`AI_GATEWAY_API_KEY`, or link a Vercel project with `eve link` for
OIDC). To call a provider directly, set its key (`ANTHROPIC_API_KEY`,
`XAI_TOKEN`, `PERPLEXITY_API_TOKEN`, …) and select it with `MSTRMND_PROVIDER`.

```bash
MSTRMND_PROVIDER=perplexity AUTH_SECRET=$(openssl rand -hex 32) pnpm dev
```

### Auth

Email/password auth issues a signed-JWT session cookie (`jose`, HS256). The
same cookie gates the app (via `middleware.ts`) **and** the agent (via
`agent/channels/eve.ts`, which maps the session to a user principal). The
Third-Mind is scoped to the caller's `workspaceId`, so workspaces never see each
other's memory. Set `AUTH_SECRET` in every environment (a stable random string;
the app and agent must share it).

### Database (Postgres / Neon)

Set `DATABASE_URL` to a Postgres connection string and both the user store and
the Third-Mind persist in Postgres; the schema (`users`, `observations`) is
created idempotently on first use, and Third-Mind search uses Postgres
full-text ranking. On Neon, use the pooled connection string with
`?sslmode=require`. Without `DATABASE_URL`, both fall back to file-backed dev
stores. Add `DATABASE_URL` as a secret — never commit it.

```bash
DATABASE_URL="postgres://user:pass@host/db?sslmode=require" \
AUTH_SECRET=... MSTRMND_PROVIDER=perplexity pnpm dev
```

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js + eve dev server |
| `pnpm eve:info` | Inspect the discovered agent surface |
| `pnpm test:memory` | Offline Third-Mind round-trip test |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | Production build (standalone Node server off Vercel) |
| `docker build -t mstrmnd-os .` | Self-hosted container image |

## Portability

Vercel is a deployment target, not a dependency. The same source builds a plain
Node container, and every platform surface is one adapter selected by
environment variable:

| Surface | Adapter | Switch |
| --- | --- | --- |
| Host runtime | Next.js `output: "standalone"` | `MSTRMND_STANDALONE` (auto off Vercel) |
| Sandbox | `agent/sandbox.ts` | `MSTRMND_SANDBOX` = `auto`/`vercel`/`docker`/`microsandbox`/`justbash` |
| Durability | `agent/agent.ts` | `MSTRMND_WORKFLOW_WORLD` (build time; unset → local file world) |
| Models | `agent/lib/model.ts` | `MSTRMND_MODEL_BASE_URL` / `MSTRMND_PROVIDER` |
| Data | `lib/db.ts` | `DATABASE_URL` (any Postgres) |

Run the whole stack off-platform:

```bash
AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose -f ../infrastructure/docker-compose.self-host.yml up --build
curl http://localhost:3000/eve/v1/health
```

Sandbox egress defaults to `deny-all` (`MSTRMND_SANDBOX_NETWORK`) because
`execute_code` runs model-authored commands. Full ledger and exit plan:
[`../docs/portability.md`](../docs/portability.md).

## Slice status

Landed so far:

- Maestro root orchestrator with Researcher / Critic / Memory-Keeper subagents.
- Multi-tenant Third-Mind memory with `memory_{read,write,search,list}` tools, a
  durable file-backed store, and an interactive dashboard — scoped per workspace.
- Swiss/dark Alliance command UI streaming live Maestro turns via `useEveAgent`.
- **Auth**: sign in / sign up pages, JWT session cookie, `middleware.ts` app
  gating, and a session-verifying `agent/channels/eve.ts` so the agent is
  protected by the same identity and memory is workspace-scoped.
- `withEve(withWorkflow(...))` composed; a `parallel-council` workflow pattern.
- Approval-gated `execute_code` running against a **backend-agnostic sandbox**
  (`ctx.getSandbox()`), with the backend chosen in `agent/sandbox.ts`.
- **Portability slice**: standalone build, self-host Dockerfile + compose stack,
  swappable sandbox / durability / model-gateway adapters.

Production data layer: **Postgres/Neon adapter implemented** for users +
Third-Mind (gated on `DATABASE_URL`). Next slices: pgvector semantic recall;
binding workflow steps to real subagents (Orchestrator-Worker, Evaluator-Loop);
sandbox execution; Slack/cron channels; OAuth (GitHub/Google) sign-in; evals.

### Notes & limits

- The sandbox-backed built-in tools (`bash`, file tools) are disabled in favor
  of the approval-gated `execute_code`; enabling them is the execution slice.
- Live tool-calling and subagent delegation need a tool-capable model with
  credits (xAI/Gateway); the Perplexity fallback streams text but does not call
  tools.
