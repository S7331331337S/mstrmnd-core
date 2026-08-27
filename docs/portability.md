# Portability — the exit plan

MSTRMND OS runs on Vercel today. This document is the standing answer to "what
would it take to leave?" — a named ledger of every platform coupling, the
adapter that replaces it, and the command that proves the replacement works.

The rule behind it is already in [`AGENTS.md`](../AGENTS.md): **adapters at the
edge**. It applies to hosting exactly as it applies to model providers and to
Obsidian. A host is an execution resource. The alliance, its memory, and its
coordination are what persist.

> Day-to-day agent alignment and backlog: [`MASTER.md`](./MASTER.md).
> Doctrine vs. runtime: [`runtime-boundaries.md`](./runtime-boundaries.md).

---

## The ledger

| Coupling | Where it lives | Replacement | Selected by |
|---|---|---|---|
| Agent framework | `eve` (Apache-2.0), `mstrmnd-os/agent/**` | None needed — `eve build` emits a self-contained Nitro server at `.output/server/index.mjs` | build target |
| Host runtime | Next.js 16.3 (`mstrmnd-os/app/**`) | `output: "standalone"` → `.next/standalone/server.js` in a container | `MSTRMND_STANDALONE` (auto: on unless `VERCEL` is set) |
| Durable execution | Workflow SDK, `mstrmnd-os/workflows/**` | eve's file-backed local world (`.eve/.workflow-data`) on a mounted volume, or a Workflow world package | `MSTRMND_WORKFLOW_WORLD` (build time) |
| Code execution | approval-gated `execute_code` | Docker / microsandbox / just-bash backends behind `agent/sandbox.ts` | `MSTRMND_SANDBOX` |
| Model access | `agent/lib/model.ts` | Self-operated OpenAI-compatible gateway (LiteLLM, Portkey, vLLM, Ollama), or a direct provider SDK | `MSTRMND_MODEL_BASE_URL` / `MSTRMND_PROVIDER` |
| Data | `mstrmnd-os/lib/db.ts` | Already portable — any Postgres via `DATABASE_URL` | connection string |
| Auth | `lib/session.ts` (JWT via `jose`), `agent/channels/eve.ts` | Already portable — no platform identity provider; `AUTH_SECRET` is ours | — |
| Mobile client | `mstrmnd-alliance` | Points at a configurable base URL, never a baked-in domain | `EXPO_PUBLIC_MSTRMND_API_URL` |
| WebGPU docs MCP | `mstrmnd-os/agent/connections/vgpu.ts` | Local `npx vgpu mcp` (stdio or HTTP) | `MSTRMND_VGPU_MCP_URL` |

Nothing in the table is a rewrite. Every row is a configuration change, because
each vendor surface is reached through a seam rather than imported into domain
code.

---

## What stays vendor-shaped, deliberately

Two things are *chosen*, not inherited, and are worth re-deciding rather than
defending:

- **`eve` and the Workflow SDK are Vercel-authored.** Both are open source and
  both document a self-hosted path, so the risk is direction-of-travel, not a
  locked door. The mitigation is that agent behavior lives in `agent/` as
  markdown and typed tools — the same authored directory eve reads on any host.
- **The Vercel AI Gateway is a convenient default, not a requirement.** Set
  `MSTRMND_MODEL_BASE_URL` and model traffic goes through infrastructure we
  operate instead. The gateway remains first in precedence only when no
  self-hosted gateway is configured.

---

## How the container is composed

Off Vercel, `withEve` does not fold the agent into the Next server — it bakes a
rewrite from `/eve/v1/*` to a loopback port into the production route manifest.
The self-hosted image therefore runs **two processes**, which is the entire
difference from the platform deployment:

```
node .output/server/index.mjs   # eve agent runtime (Nitro) on 127.0.0.1:4274
node server.js                  # Next.js standalone on 0.0.0.0:3000 → proxies /eve/v1/*
```

`docker-entrypoint.sh` starts the runtime, waits for `/eve/v1/health`, then
starts the UI, and exits the container if either dies. The port is compiled into
the route manifest, so the build and the runtime must agree on
`EVE_NEXT_PRODUCTION_PORT` (the `EVE_PORT` build arg keeps them aligned).

Two build-shape details worth keeping:

- `outputFileTracingRoot` is pinned to the app directory. `mstrmnd-os` is a
  nested pnpm workspace, so without it Next traces up to the outer lockfile and
  emits `.next/standalone/mstrmnd-os/server.js` instead of a flat root.
- `outputFileTracingIncludes` names `@swc/helpers` explicitly. pnpm's symlinked
  store hides it from the tracer, and `node server.js` fails on
  `MODULE_NOT_FOUND` without it.

## Leaving, concretely

### 1. Run the whole stack off-platform

```bash
AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose -f infrastructure/docker-compose.self-host.yml up --build
```

Brings up the standalone Next.js server (UI + the eve runtime same-origin at
`/eve/v1/*`), durable workflow state on a named volume, and Postgres. Verify:

```bash
curl http://localhost:3000/eve/v1/health
```

### 2. Or build the image alone

```bash
cd mstrmnd-os
docker build -t mstrmnd-os .
docker run -p 3000:3000 --env-file .env -v mstrmnd-eve:/app/.eve mstrmnd-os
```

The image is plain Node. It runs unchanged on ECS/Fargate, Cloud Run, Fly,
Railway, Kubernetes, or one VPS.

**Verified locally** (Node 24, no Vercel credentials, no platform APIs):
`eve build` produces the Nitro runtime and it answers `/eve/v1/health`;
`next build` produces a flat standalone server; the standalone server proxies
`/eve/v1/health` through to the runtime and serves the UI. What is *not* yet
verified is a real `docker build` of the image and the Docker sandbox backend
against a live daemon — do that once before treating the exit path as rehearsed.

### 3. Route the proxy correctly

A reverse proxy must forward **both** prefixes without rewriting them:

- `/eve/` — health, sessions, streams, channels, tools, subagents
- `/.well-known/workflow/` — workflow callbacks

Forwarding only `/eve/` lets a session start and then stall when its callback
cannot reach the runtime.

### 4. Keep state where you can carry it

- Postgres holds users and the Third-Mind. Any provider; `DATABASE_URL` decides.
- `/app/.eve` holds durable session and run state under the local Workflow
  world. Mount it on persistent storage, or bind an external world with
  `MSTRMND_WORKFLOW_WORLD` at build time.

---

## Environment reference

| Variable | Default | Purpose |
|---|---|---|
| `MSTRMND_STANDALONE` | auto (`1` off Vercel) | Force/suppress the standalone Next.js build |
| `MSTRMND_WORKFLOW_WORLD` | unset → local file world | Workflow world package, read at **build** time |
| `MSTRMND_SANDBOX` | `auto` | `vercel` \| `docker` \| `microsandbox` \| `justbash` |
| `MSTRMND_SANDBOX_NETWORK` | `deny-all` | Sandbox egress policy |
| `MSTRMND_SANDBOX_IMAGE` | eve's published image | Base image for the container/VM backends |
| `MSTRMND_MODEL_BASE_URL` | unset | Self-hosted OpenAI-compatible gateway; wins over the AI Gateway |
| `MSTRMND_MODEL_API_KEY` | unset | Credential for that gateway |
| `MSTRMND_PROVIDER` | precedence | `compatible` \| `gateway` \| `anthropic` \| `openai` \| `xai` \| `perplexity` |
| `MSTRMND_VGPU_MCP_URL` | `https://vgpu.sh/api/mcp` | vgpu docs/examples MCP; set to a local `npx vgpu mcp` URL to leave the hosted server |
| `DATABASE_URL` | file-backed dev store | Any Postgres |
| `AUTH_SECRET` | — | Shared by the app and the agent; required in every environment |

`auto` sandbox selection resolves in eve's own priority order: Vercel Sandbox
when deployed on Vercel, then Docker, then microsandbox, then just-bash.

**Egress is default-closed.** `MSTRMND_SANDBOX_NETWORK` defaults to `deny-all`
because `execute_code` runs model-authored commands. Open it deliberately, per
environment, and prefer the `vercel()` or `microsandbox()` backends when you
need a domain allow-list rather than an on/off switch — the Docker backend
supports only all-or-nothing egress.

---

## Rules that keep this true

Enforced by [`.cursorrules`](../.cursorrules) and reviewed on every PR:

1. Domain code — agents, tools, subagents, skills, schemas — never imports a
   hosting SDK. Tools call `ctx.getSandbox()`; the backend is named once, in
   `agent/sandbox.ts`. `@vercel/sandbox` is no longer a direct dependency at all
   — eve carries its own copy behind the `vercel()` backend.
2. New infrastructure coupling arrives as an adapter plus an environment switch,
   with a documented non-Vercel path, or it does not arrive.
3. Every row above stays honest. If a coupling is added and cannot be swapped,
   say so in this table instead of leaving it undiscovered.
4. Vendor data shapes translate into the schemas in `packages/schemas` at the
   edge. That boundary is what makes the swap a configuration change.
