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

- Obsidian vault → `MemoryEngine` (ranked keyword search) + in-memory graph (tags / wikilinks / folders)
- Vault-authored `identity.md` loading
- MCP server tools: `search_memory`, `get_note`, `get_identity` (early plugin surface)
- Hermes CLI vault smoke-load (**not** an orchestrator yet)
- Scope + provenance on memory / identity / artifacts; Obsidian → `MemorySourceRecord` adapter
- Audit + policy **schemas only** (not enforced in a live agent loop)
- Doctrine pin **active** at `S7331331337S/mstrmnd.md@7db4af9a67baed2d20be9b4ded2bc7fe6ce9ecfc` + CI verify gate
- Editorial worker exists but is **out of active focus**

What is missing for the current focus:

- Company / business / operator **context assembly** (doctrine + identity + workspace)
- Agent **orchestrator** (parent agent, sub-agents, run state)
- First-class **folder/file workspace** contracts beyond Obsidian notes-as-memory
- Agent / sub-agent specs wired into Hermes
- Transportable **plugin** packaging beyond today’s MCP server
- **Template** for onboarding a new operator/harness

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

**Intelligence layer core — context, workspace, orchestrator, agents.**

Phase 0 (doctrine) and Phase 1 (scope schemas) are done. PRESS reference workflow is deferred.

---

## Shared backlog

Update checkboxes here when work lands.

### Done

- [x] Doctrine pin + sync + CI
- [x] Scope / provenance on memory, identity, artifacts
- [x] Obsidian adapter boundary (`MemorySourceRecord`)
- [x] Audit + policy schema contracts

### Now — operator context + workspace

- [ ] Define **operator / company / business context** schema (org profile, goals, systems map pointers, brand refs, doctrine slice)
- [ ] Context assembler: doctrine (pinned) + identity + memory retrieval → scoped context pack for a run
- [ ] **Workspace** model: folders, files, mounts with scope + provenance (Obsidian/fs as adapters)
- [ ] MCP tools for workspace read/list (files/folders) without breaking existing memory tools

### Next — orchestrator + agents

- [ ] Run state model (run id, parent agent, sub-agents, status, scope)
- [ ] Hermes evolves from smoke CLI → **orchestrator shell** (dispatch one parent agent)
- [ ] Sub-agent handoff contract (input/output schema, permissions subset of parent)
- [ ] Wire at least one real agent path (not Vision stub-only) against context + workspace
- [ ] Record doctrine ref + scope on every run

### Then — transportable plugin

- [ ] Package MCP (and later other hosts) as the **plugin boundary**: stable tool/resource API over core
- [ ] Document how a host loads MSTRMND (env, doctrine pin, workspace root, identity)
- [ ] Keep providers replaceable behind the plugin

### Later — onboarding template

- [ ] Operator template: folder layout + context stubs + agent graph defaults + harness adapter config
- [ ] “New operator” bootstrap that does not fork `mstrmnd-core`

### Deferred (do not start unless asked)

- PRESS `/render` → approve → `/stage` governance
- Brand verify / Signal-on-publish wiring
- Full multi-tenant managed deploy
- Empty package scaffolding for optics

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
4. **Adapters ≠ domain.** Files/folders/Obsidian translate at the edge.
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
| Doctrine sync | [`doctrine-integration.md`](./doctrine-integration.md) |
| Overview | [`../README.md`](../README.md) |

---

## Status stamp

- **Last aligned:** 2026-08-04
- **Priority shift:** Away from PRESS; toward agent intelligence, operator/company context, orchestrator, agents/sub-agents, files/folders, then plugin → template
- **Code maturity:** Scoped memory MVP + doctrine pin; orchestrator/context/workspace not built yet
- **Next merge target:** operator/company context schema + context assembler skeleton
