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
- `WorkspaceService` mounts with list/read/stat, path-escape denial, and **policy-gated `draft_write`** (vault stays read-only; approve copies drafts → staging)
- Hermes orchestrator: parent `operator-agent` + `workspace-scout`; executes model-proposed allowlisted tools (fallback loop when the plan is not JSON); `--approve` / `--reject` / `--show`
- Shared `createRuntime()` factory used by Hermes and MCP
- MCP tools: `search_memory`, `get_note`, `get_identity`, `get_context`, `list_workspace`, `read_file`, `list_agents`, `run_agent`, `get_run`, `approve_run`, `reject_run`
- Operator pack template + `pnpm operator:init`
- Doctrine pin active; `pnpm verify` CI gate
- Editorial worker exists but is **out of active focus**
- vgpu stack tools on Maestro (`vgpu_docs` + `vgpu_examples`; URL via `MSTRMND_VGPU_MCP_URL`)
- **Field** (`/field`) — public platinum raymarch: vgpu WebGPU with WebGL2 fallback
- **Board** (`apps/board`) — Expo decision-room: seven specialists + Chair, opening / crossfire / ruling. Live rooms stream through `mstrmnd-os` (`hosted`); offline demo stays for tests. Isolated from the pnpm workspace.

What is still thin / next:

- Stronger policy enforcement (rule registry, modify outcomes) on orchestrator runs
- Shared audit/run schema usage inside `mstrmnd-os` (Board file ledger is a separate shape today)
- Additional host transports beyond MCP stdio
- Multi-operator managed deploy
- Extract Board packages only after the app runs intact (`deliberation`, `agent-roster`, `model-router`, `design-tokens`)

**Two runtimes (until a later adapter):** Hermes/MCP boot `@mstrmnd/intelligence-core`. Board live path and Field boot eve inside `mstrmnd-os`. They do not share packages today. `mstrmnd-os` is a nested pnpm workspace (Node 24), not part of the root graph.

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

Next hardening: bind Hermes/MCP and `mstrmnd-os` to the same run/audit/policy contracts, then plugin auth. `openai` / `openai-compatible` already landed; CI still defaults to `echo`.

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
- [x] **Workspace** model: mounts, list/read/stat with path guards
- [x] MCP tools for workspace + context (`get_context`, `list_workspace`, `read_file`)
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
- [x] **Bounded CI repair orchestration**: on CI failure, Codex proposes and
      verifies a minimal patch in a reviewable PR; stop after three failed rounds

### Next (Operator Zero)

- [x] Policy-gated workspace writes (draft → human approval → publish; no env bypass)
- [x] Richer parent loop: execute model-proposed allowlisted tools (still policy-checked)
- [x] CI typecheck for `mstrmnd-os` on Node 24 (keep it out of the root pnpm workspace)
- [ ] Shared run/audit/policy records in `mstrmnd-os` (Board + Maestro)
- [ ] MCP auth/scope for the plugin host

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
- Plugin SDK / onboarding template (after Operator Zero can write + plan)
- Un-gated / auto-publish workspace writes (policy-gated writes are Next, not deferred)

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

---

## Status stamp

- **Last aligned:** 2026-09-08
- **Priority:** Operator Zero dogfood — approved drafts in daily use, then shared contracts with `mstrmnd-os`, then plugin auth. Plugin SDK after that.
- **Code maturity:** Operator Zero runtime with context pack, policy-gated draft writes (vault read-only; staging on approve), Hermes plan-execute loop + fallback, MCP approve/reject, openai-compatible provider (CI default `echo`); Board decision-room at `apps/board`; `mstrmnd-os` typecheck on Node 24 in CI
- **Next:** Shared run/audit/policy with `mstrmnd-os`; MCP auth/scope; dogfood the write loop
