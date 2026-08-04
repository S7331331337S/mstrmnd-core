# MSTRMND Core — Agent Master Plan

**Read this first.** Every agent working in this repo (Claude, GPT, Grok, Copilot, Cursor Cloud, Hermes) should treat this file as the shared operating brief.

If this file conflicts with older docs or chat context, prefer: (1) hard invariants in `AGENTS.md`, (2) this master plan, (3) `mstrmnd.md` doctrine when pinned, (4) other docs.

---

## Mission

Build **MSTRMND** as a **model-agnostic agent intelligence layer** that sits between an operator’s vision and daily execution.

Models are interchangeable execution resources. This repo owns the persistent layer: context, memory, orchestration, skills, tools, connectors, policy, evaluation, and learning.

Canonical product line:

> MSTRMND installs the intelligence layer between a company's vision and its daily execution.

---

## Strategy: Operator Zero first

We build the runtime by operating **ourselves** first, then productize the same framework for other operators.

| Stage | Who | What ships |
|---|---|---|
| **1. Operator Zero** | MSTRMND (this company) | Dogfood the full loop on our own work — memory, identity, editorial PRESS, approvals, doctrine context |
| **2. Operator package** | Other companies / operators | Same runtime + schemas; their org/workspace context, brand, policies, connectors, and workflows as configuration and adapters — not a fork |

### Implications for agents

- Prefer deepening the working local MVP over inventing a multi-tenant platform shell.
- Do not build “client onboarding product” before Operator Zero can run a governed loop on MSTRMND’s own context.
- When adding abstractions (scope, registries, policy), extract them from real Operator Zero behavior — especially the editorial closed loop and vault memory path.
- Empty package trees that only mirror the target architecture are forbidden.

---

## Repository roles

| Repo | Owns |
|---|---|
| [`mstrmnd.md`](https://github.com/S7331331337S/mstrmnd.md) | Doctrine: philosophy, standards, agent/skill/connector specs, brand, commercial, roadmap |
| **`mstrmnd-core` (this repo)** | Executable runtime: packages, adapters, workflows, policy enforcement, MCP, Hermes, editorial workers |

When implementation and doctrine conflict, update doctrine in `mstrmnd.md` first, then pin and adopt here. Do not let code drift become silent policy.

Details: [`runtime-boundaries.md`](./runtime-boundaries.md), [`doctrine-integration.md`](./doctrine-integration.md).

---

## Current reality (code)

What actually works today:

- Obsidian vault → `MemoryEngine` (ranked keyword search) + in-memory graph (tags / wikilinks / folders)
- Vault-authored `identity.md` loading
- MCP server tools: `search_memory`, `get_note`, `get_identity`
- Hermes CLI vault smoke-load (not a full agent loop yet)
- Editorial HTTP worker (`editorial_worker.py`) wrapping external PRESS kit generation; `/stage` is the publish gate

What is scaffold / external / not wired:

- Hermes as observe → plan → execute → reflect
- Semantic / vector search (`VectorEngine` stub)
- Graph exposed via MCP
- `@mstrmnd/agents` VisionAgent unused by apps
- Doctrine sync / pin (docs only; `MSTRMND_DOCTRINE_REF` example still `main`)
- Brand `verify_issue_kit.py` and Signal-on-publish (documented invariants; not enforced in this repo yet)
- Tests, lint, CI
- Target packages (`@mstrmnd/context`, `orchestrator`, `policy`, etc.) — **direction only**, create when they own real behavior

---

## Target shape (do not rush)

Progressive domains (create only with real contracts + behavior):

```text
@mstrmnd/context
@mstrmnd/memory
@mstrmnd/orchestrator
@mstrmnd/model-router
@mstrmnd/skills
@mstrmnd/tools
@mstrmnd/connectors
@mstrmnd/policy
@mstrmnd/workflows
@mstrmnd/evals
@mstrmnd/observability
@mstrmnd/schemas
```

Full phased plan: [`modernization-roadmap.md`](./modernization-roadmap.md).

---

## Active phase

**Phase 0 — Alignment** (docs largely done) → **execute remaining Phase 0 backlog, then Phase 1 schemas/scope.**

Guiding rule from the roadmap: extract stable domains from current behavior, preserve the local vault path, add governance before autonomy.

---

## Shared backlog

Update checkboxes in this file when work lands. Do not maintain a parallel shadow TODO elsewhere.

### Now — Phase 0 closeout

- [ ] Pin `MSTRMND_DOCTRINE_REF` to a reviewed commit SHA or release tag (not floating `main`)
- [ ] Implement doctrine sync → `.generated/mstrmnd-md/` + `manifest.json`
- [ ] CI: typecheck + doctrine pin/manifest validation
- [ ] Document known gaps / tech debt in sync with this file (keep MASTER truthful)

### Next — Phase 1 foundations (Operator Zero)

- [ ] Add organization / workspace / user / run scope (+ provenance) to schemas
- [ ] Keep personal Obsidian vault path working under a default local scope
- [ ] Extract Obsidian interfaces from memory domain logic (adapter boundary)
- [ ] Add audit-event schema
- [ ] Add policy decision contract (`allow` / `deny` / `modify` / `require-approval`)

### Then — first governed reference workflow

Use MSTRMND // PRESS editorial as Operator Zero’s first closed loop:

```text
Campaign brief
→ company and brand context retrieval
→ plan generation
→ human plan approval
→ asset generation
→ brand and quality evaluation
→ human publish approval (/stage)
→ distribution
→ performance ingestion
→ next-brief recommendation
```

- [ ] Wire audit + approval around existing render/stage/discard path
- [ ] Invoke brand verification after render (bring or call `verify_issue_kit`)
- [ ] Record doctrine ref on runs/artifacts that used doctrine context
- [ ] Expose graph neighbors / connections via MCP (data already built)
- [ ] Evolve Hermes from smoke CLI toward a real runtime shell over this loop

### Later (do not start early)

- Registries for agents / skills / tools / connectors / models / policies / workflows
- Durable orchestration (resume, idempotency, model fallback)
- Multi-tenant isolation and managed deploy profiles
- Operator dashboard / client onboarding productization
- Semantic embeddings + external graph DB unless Operator Zero retrieval clearly needs them

---

## Non-goals (until Operator Zero loop is real)

- Creating empty packages to look complete
- Replacing working local-first behavior before an adapter exists
- Treating MCP as the entire orchestration system
- Broad autonomy without policy, audit, and evaluation
- Embedding client-specific business logic in core packages
- Building the “package that builds other operators’ context” before we can run our own

---

## Hard invariants (runtime + brand)

Copied for agent visibility; full detail in `AGENTS.md`:

1. **Human approval is a hard stop** for publish and other consequential actions. Flow = draft → approve → execute. Nothing auto-publishes.
2. **Editorial brand — one accent only:** Platinum `#e8e2d0` on obsidian `#0a0a0b`. No cyan/teal/blue accents.
3. **Providers stay replaceable.** No hard dependency on one model vendor in domain logic.
4. **Adapters ≠ domain.** Obsidian and other vendors translate at the edge into stable schemas.
5. **Explicit scope.** Every memory, credential, tool call, and artifact must eventually carry scope; deny cross-scope by default.
6. **Doctrine is pinned.** Never fetch mutable doctrine mid-run.

Consequential actions that require policy + usually approval: external comms, publishing, money, irreversible deletes, permission changes, production code changes, contracts, sensitive disclosure.

---

## Multi-agent collaboration rules

We develop this repo with multiple models in parallel. Stay aligned:

1. **Read `docs/MASTER.md` + `AGENTS.md` before planning or coding.**
2. **Prefer small PRs** that advance one backlog item; update this backlog when merging.
3. **Do not invent a second roadmap** in chat-only notes — write durable decisions here or in the linked docs.
4. **Preserve the working MVP path** (vault load, MCP tools, typecheck) unless the PR deliberately migrates it.
5. **Name reality accurately** — if Hermes is still a smoke CLI, don’t document it as a full agent loop in the same PR without implementing it.
6. **Stack:** pnpm 10+ / Node 20+ / turbo from repo root. Never npm.
7. **Verify:** `pnpm typecheck` before declaring done. Add tests when touching schemas, policy, or retrieval.
8. **Doctrine changes** belong in `mstrmnd.md`, then a pin bump here — not silent README rewrites that contradict canon.

---

## Quick pointers

| Need | File |
|---|---|
| Agent tooling + brand invariants | [`../AGENTS.md`](../AGENTS.md) |
| Phased modernization | [`modernization-roadmap.md`](./modernization-roadmap.md) |
| Doctrine vs runtime boundary | [`runtime-boundaries.md`](./runtime-boundaries.md) |
| Doctrine sync contract | [`doctrine-integration.md`](./doctrine-integration.md) |
| Human-facing overview | [`../README.md`](../README.md) |
| Env examples | [`.env.example`](../.env.example), [`.env.doctrine.example`](../.env.doctrine.example) |

---

## Status stamp

- **Last aligned:** 2026-08-04
- **Branch intent for this alignment:** Operator Zero + model-agnostic framing; shared agent master plan
- **Code maturity:** Local MVP (memory / identity / MCP / editorial worker foundations)
- **Next merge target after alignment docs:** doctrine pin + sync script + CI gate
