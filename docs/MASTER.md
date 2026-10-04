# MSTRMND Core — Agent Master Plan

**Read this first.** Every agent working in this repo (Claude, GPT, Grok, Copilot, Cursor Cloud, Hermes) should treat this file as the shared operating brief.

If this file conflicts with older docs or chat context, prefer: (1) hard invariants in `AGENTS.md`, (2) this master plan, (3) `mstrmnd.md` doctrine when pinned, (4) other docs.

---

## Mission

Build **MSTRMND** as a **model-agnostic agent intelligence layer** that sits between an operator’s vision and daily execution.

Models are interchangeable execution resources. This repo owns the persistent layer: **company / business / operator context**, memory, **agent orchestration** (agents + sub-agents), files/folders as first-class workspace substrate, skills/tools, policy, and evaluation.

Canonical product line:

> MSTRMND installs the intelligence layer between a company's vision and its daily execution.

### Delivery shape (in order)

| Form | Intent |
|---|---|
| **1. Runtime (this repo)** | Dogfood Operator Zero — context, orchestrator, agents, workspace files |
| **2. Transportable plugin** | Same layer loads into a host (Cursor MCP, CLI, agent harness) without forking core |
| **3. Onboarding template** | Repeatable pack that boots any harness with operator context + agent graph |

PRESS / editorial is **deferred** — keep the worker compiling, do not prioritize publish-gate work until the intelligence layer above is real.

---

## Strategy: Operator Zero first

We build the runtime by operating **ourselves** first, then productize the same framework for other operators.

| Stage | Who | What ships |
|---|---|---|
| **1. Operator Zero** | MSTRMND | Company + operator context, file/folder workspace, Hermes orchestrator, agents/sub-agents, doctrine-backed intelligence |
| **2. Plugin** | Same runtime | Host adapters (MCP, stdio, future harness SDKs) so the layer is transportable |
| **3. Template** | Other operators | Config + context pack that onboards a new company onto any supported harness |

### Implications for agents

- Prefer **context → orchestrator → agents → workspace files** over creative/editorial pipelines right now.
- Do not expand PRESS/`editorial_worker.py` unless explicitly requested.
- Extract packages only when they own real behavior (no empty `@mstrmnd/*` trees).
- Plugin/template work comes **after** Operator Zero can assemble context and run a parent agent with sub-agents against scoped files/memory.

---

## Repository roles

| Repo | Owns |
|---|---|
| [`mstrmnd.md`](https://github.com/S7331331337S/mstrmnd.md) | Doctrine: philosophy, standards, agent/skill/connector specs, brand, commercial, roadmap |
| **`mstrmnd-core` (this repo)** | Executable runtime: context, memory, orchestrator, agents, adapters, MCP plugin surface |

When implementation and doctrine conflict, update doctrine in `mstrmnd.md` first, then pin and adopt here.

Details: [`runtime-boundaries.md`](./runtime-boundaries.md), [`doctrine-integration.md`](./doctrine-integration.md).

---

## Current reality (code)

What actually works today:

- Obsidian vault → `MemoryEngine` + graph; scoped memory/identity/artifacts
- `assembleContext()` → `ContextPack` (doctrine pin + company/operator + identity + memory hits)
- `WorkspaceService` mounts with list/read/stat/write; writes stage under `.mstrmnd/drafts/` and publish only after human approval
- Hermes orchestrator shell: parent `operator-agent` + `workspace-scout` sub-agent (default `EchoProvider`; `openai` / `openai-compatible` when env is set). Parent executes **model-proposed** allowlisted tools (`evaluateBoundaryAction` on each dispatch). Interactive writes prompt `y/yes`; non-interactive and `--dry-run` never publish. `Orchestrator.createRun` is fail-closed on a `ThreatBoundary`; `createRuntime` attaches the Operator Zero default (deny-all egress).
- Shared `createRuntime()` factory used by Hermes, MCP, and the HTTP host
- MCP tools: `search_memory`, `get_note`, `get_identity`, `get_context`, `list_workspace`, `read_file`, `write_file` (draft), `approve_write`, `list_agents`, `run_agent` (stdio + streamable HTTP)
- HTTP host (`@mstrmnd/host`): `/health`, `/v1/*`, `/mcp`, `/adk`, `/.well-known/agent.json`; CLI remains Hermes
- Portable stack: `infrastructure/Dockerfile.core` + `docker-compose.stack.yml` (core + Postgres; OS via `--profile os`)
- Stack test CLIs: `@mstrmnd/stack-tools` wraps `@vercel/sdk` + `vercel` CLI + `gh` (read-only probes)
- Operator pack template + `pnpm operator:init`; the pack's `boundary.json` is the run `ThreatBoundary` (loaded by `createRuntime()`, fail-closed on invalid, `source=pack` in Hermes / `/health`)
- Doctrine pin active; `pnpm verify` CI gate
- Editorial worker exists but is **out of active focus**
- vgpu stack tools on Maestro (`vgpu_docs` + `vgpu_examples`; URL via `MSTRMND_VGPU_MCP_URL`)
- **Field** (`/field`) — public platinum raymarch: vgpu WebGPU with WebGL2 fallback
- **Board** (`apps/board`) — Expo decision-room: seven specialists + Chair, opening / crossfire / ruling. Live rooms stream through `mstrmnd-os` (`hosted`); offline demo stays for tests. Isolated from the pnpm workspace.

What is still thin / next:

- Plugin SDK / extra harness adapters (HTTP + MCP HTTP + ADK card + CLI are landed)
- Multi-operator managed deploy
- Extract Board packages only after the app runs intact (`deliberation`, `agent-roster`, `model-router`, `design-tokens`)

**Two runtimes (until a later adapter):** Hermes/MCP boot `@mstrmnd/intelligence-core` (root pnpm workspace, Node 20 in CI). Board live path and Field boot eve inside `mstrmnd-os` (nested pnpm workspace, Node 24). They do not share packages today. Do not fold `mstrmnd-os` into the root graph. CI runs `pnpm --dir mstrmnd-os typecheck` as a separate job (`next typegen` then `tsc --noEmit`; `next-env.d.ts` is gitignored).

**Models:** `openai` / `openai-compatible` Chat Completions provider is landed; CI and Hermes default remain `echo`.

---

## Target shape (create only with real behavior)

```text
@mstrmnd/schemas          ← exists (scope, provenance, audit, policy, memory…)
@mstrmnd/context          ← company / operator / task context assembly
@mstrmnd/memory           ← evolve from intelligence-core memory path
@mstrmnd/orchestrator     ← runs, agents, sub-agents, handoffs
@mstrmnd/agents           ← agent implementations (exists as scaffold)
@mstrmnd/workspace        ← folders, files, mounts (adapter-backed)
@mstrmnd/tools            ← bounded actions
@mstrmnd/connectors       ← exists (Obsidian + stubs)
@mstrmnd/policy           ← enforce PolicyDecision
@mstrmnd/plugin           ← host adapters (MCP first)
```

Full longer roadmap: [`modernization-roadmap.md`](./modernization-roadmap.md). Prefer **this file** for near-term priority.

---

## Active phase

**Intelligence layer core — landed (context, workspace, orchestrator, plugin factory, operator pack).**

Next hardening: plugin SDK after this Operator Zero stack. HTTP host, MCP streamable HTTP, ADK card, echo calibration, and the core container image are landed. Policy-gated workspace writes, model-proposed parent planning, `mstrmnd-os` Node 24 typecheck in CI, fail-closed ThreatBoundary attach, and per-tool `evaluateBoundaryAction` on dispatch landed. `openai` / `openai-compatible` already landed; CI still defaults to `echo`.

PRESS reference workflow remains deferred.

---

## Shared backlog

Update checkboxes here when work lands.

### Done

- [x] Doctrine pin + sync + CI
- [x] Scope / provenance on memory, identity, artifacts
- [x] Obsidian adapter boundary (`MemorySourceRecord`)
- [x] Audit + policy schema contracts
- [x] Define **operator / company / business context** schema
- [x] Context assembler: doctrine + identity + memory → `ContextPack`
- [x] **Workspace** model: mounts, list/read/stat/write with path guards; drafts under `.mstrmnd/drafts/`
- [x] MCP tools for workspace + context (`get_context`, `list_workspace`, `read_file`, `write_file`, `approve_write`)
- [x] Run state / agent specs + orchestrator + EchoProvider
- [x] Hermes orchestrator shell (parent + workspace-scout sub-agent)
- [x] Shared `createRuntime` factory (MCP + Hermes plugin boundary)
- [x] Operator pack template + `pnpm operator:init`
- [x] **Host portability**: sandbox/durability/model-gateway adapters in
      `mstrmnd-os`, standalone build + self-host Dockerfile & compose stack,
      mobile client on a configured base URL, ledger in `portability.md`
- [x] **vgpu stack tool**: `vgpu_docs` / `vgpu_examples` wrap the public
      [vgpu.sh](https://vgpu.sh) MCP via `agent/lib/vgpu-mcp.ts`, plus
      `.cursor/mcp.json` for Cursor agents. Public `/field` demo: vgpu
      WebGPU path plus a matching WebGL2 fallback (platinum / obsidian only).
- [x] **Board import**: extract `apps/mstrmnd` from `S7331331337S/skills` into
      `apps/board` with history; keep isolated from the pnpm workspace
- [x] Bounded CI repair orchestration: on CI failure, Codex proposes and
      verifies a minimal patch in a reviewable PR; stop after three failed rounds
- [x] Policy-gated workspace writes (draft → human approval → publish; no env bypass)
- [x] Richer parent loop: execute model-proposed allowlisted tools (still policy-checked)
- [x] CI typecheck for `mstrmnd-os` on Node 24 (kept out of the root pnpm workspace)
- [x] Fail-closed ThreatBoundary attach on `Orchestrator.createRun`
- [x] Per-tool `evaluateBoundaryAction` on orchestrator dispatch (deny / require-approval / allow)
- [x] `spawn_subagent` accepts common `agentId` aliases and defaults to the sole allowlisted registered sub-agent when omitted

### Next (Operator Zero)

- [x] Additional host transports beyond MCP stdio (HTTP API + MCP streamable HTTP + ADK agent card + core image)
- [x] Vercel SDK/CLI + GitHub CLI stack-tools (read-only test probes; not in domain code)
- [x] Onboarding template, slice 1: operator pack `boundary.json` is executable.
      `createRuntime()` loads it for Hermes / MCP / HTTP host (`MSTRMND_OPERATOR_PACK`,
      else the vault path); invalid files fail closed; explicit `RuntimeConfig.boundary` wins
- [ ] Onboarding template, slice 2: load `agent-graph.json` into a validated agent-spec
      registry (today the runtime still uses built-in `OPERATOR_AGENT` / `WORKSPACE_SCOUT`)
- [ ] Plugin SDK (`@mstrmnd/plugin` host-adapter contract) once a second host adapter needs it

### Next (Board)

- [x] Verify Board intact here (typecheck, SSE tests, web export / demo)
- [x] Route Board model calls through `mstrmnd-os` (usage, policy, audit, budget)
- [x] Replace `EngineKind = "claude" | "demo"` with `"hosted" | "demo"`
- [x] After intact verification, return the Expo skills fork to upstream-tracking
- [ ] Later extract `packages/deliberation`, `agent-roster`, `model-router`, `design-tokens`

### Deferred (do not start unless asked)

- PRESS `/render` → approve → `/stage` governance
- Brand verify / Signal-on-publish wiring
- Full multi-tenant managed deploy
- Empty package scaffolding for optics
- Plugin SDK `@mstrmnd/plugin` (HTTP/MCP/ADK/CLI hosts landed; the onboarding template is active under Next, the SDK package still waits for a second host adapter)
- Un-gated / auto-publish workspace writes (policy-gated draft → approve → publish is landed)

---

## Non-goals (current focus)

- Expanding editorial/PRESS as the primary dogfood loop
- Creating empty packages to look complete
- Treating MCP as the entire orchestrator (it is a **transport/plugin**, not planning)
- Building the client onboarding template before Operator Zero context + orchestrator work
- Broad autonomy without scoped context and clear agent/run boundaries

---

## Hard invariants

1. **Human approval** remains a hard stop for consequential actions when those paths exist.
2. **Editorial brand** (Platinum-only) still applies when PRESS runs — but PRESS is deferred.
3. **Providers stay replaceable.**
4. **Adapters ≠ domain.** Files/folders/Obsidian translate at the edge — and so
   does hosting. Domain code never imports a hosting SDK; new vendor couplings
   ship with a non-Vercel path and a row in [`portability.md`](./portability.md).
5. **Explicit scope** on memory, credentials, tool calls, artifacts, runs.
6. **Doctrine is pinned.** Never fetch mutable doctrine mid-run.

---

## Multi-agent collaboration rules

1. **Read `docs/MASTER.md` + `AGENTS.md` before planning or coding.**
2. Prefer small PRs; update this backlog on merge.
3. Do not re-prioritize PRESS in chat — change this file if priorities shift again.
4. Preserve vault → memory → MCP unless a PR deliberately migrates it.
5. Name reality accurately (scaffold vs shipped).
6. Stack: pnpm 10+ / Node 20+ / turbo from repo root.
7. Verify: `pnpm verify`.
8. Doctrine changes in `mstrmnd.md`, then pin bump here.

---

## Quick pointers

| Need | File |
|---|---|
| Agent tooling + brand invariants | [`../AGENTS.md`](../AGENTS.md) |
| Longer phased roadmap | [`modernization-roadmap.md`](./modernization-roadmap.md) |
| Doctrine vs runtime | [`runtime-boundaries.md`](./runtime-boundaries.md) |
| Hosting lock-in + exit plan | [`portability.md`](./portability.md) |
| Doctrine sync | [`doctrine-integration.md`](./doctrine-integration.md) |
| Overview | [`../README.md`](../README.md) |
| Board decision-room | [`../apps/board/README.md`](../apps/board/README.md) |
| Next-sprint structure review (2026-09-03) | [`sprint-review-2026-09-03.md`](./sprint-review-2026-09-03.md) |

---

## Status stamp

- **Last aligned:** 2026-10-04
- **Priority:** Operator Zero MVP — portable stack (core image + compose) with API / MCP / ADK / CLI. Onboarding template is now being made executable (boundary landed; agent graph next). Plugin SDK after that.
- **Code maturity:** Operator Zero runtime with context pack, workspace mounts, policy-gated writes (draft → approve → publish), Hermes orchestrator, MCP (stdio + HTTP), HTTP host + ADK card, echo calibration cron, core container image, openai-compatible provider (CI default `echo`), fail-closed ThreatBoundary on createRun with per-tool `evaluateBoundaryAction`; Board decision-room imported at `apps/board`
- **Next:** operator pack `agent-graph.json` → validated spec registry; then plugin SDK / GHCR promotion of the core image on more hosts

## PR cleanup (2026-09-14)

- [x] Integrate the #33/#34/#36 stack on current main, preserving #31 writes and cockpit schemas.
- [x] Review #3/#16/#47 and record incompatible/deferred work with original source commits.
- See [PR cleanup decisions](pr-cleanup-2026-09-14.md) for recoverable work and enforcement limits.
