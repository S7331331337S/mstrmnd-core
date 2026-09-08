# Next cycle — The Approval Gate

**Goal of this cycle: make Operator Zero able to *act* on the workspace, and make
that action trustworthy.**

Today the runtime can read, retrieve, and summarize. It cannot change anything.
The write path is the first genuinely consequential capability in this repo — it
turns a read-only context server into something that participates in daily
execution. That is the product thesis:

> MSTRMND installs the intelligence layer between a company's vision and its daily execution.

The gate comes before the write. `AGENTS.md` calls human approval a **hard
stop**; the code does not implement one yet (see [Finding 1](#1-the-approval-gate-is-a-silent-no-op)).
Shipping writes first would mean shipping the most dangerous capability on top of
the weakest control. So this cycle builds the gate, proves it with tests, and
then lets the write through it.

> Priority and status live in [`MASTER.md`](./MASTER.md). This file is the
> execution detail behind the three open **Next (Operator Zero)** backlog items.

Roadmap mapping: this is the Operator Zero slice of
[`modernization-roadmap.md`](./modernization-roadmap.md) **Phase 5 — Policy,
Security, and Budgets**, plus the resumability half of **Phase 4**. It adopts
their exit criteria verbatim:

- every consequential tool call has an auditable policy decision
- an interrupted run can resume safely
- repeated execution cannot duplicate consequential actions

---

## Review findings

What is genuinely shipped: vault → `MemoryEngine` (+ graph) → `assembleContext()`
→ `ContextPack`; read-only `WorkspaceService` mounts with path-escape guards; a
fixed four-step orchestrator with run persistence and a JSONL audit trail; eight
MCP tools; the Hermes CLI; doctrine pin/sync with a CI fixture gate. In
`mstrmnd-os`: the eve runtime, Third-Mind memory (file or Postgres), the Board
SSE endpoint with policy/budget/audit, `/field`, JWT auth, and real portability
adapters for sandbox, model, database, workflow world, and the vgpu MCP.

Six findings shape the ordering below.

### 1. The approval gate is a silent no-op

`evaluateToolPolicy()` in `packages/intelligence-core/src/orchestrator.ts` is a
regex over the tool id (`/write|delete|publish|stage|send/i`) plus a loose suffix
match against `CONSEQUENTIAL_ACTIONS`. When the outcome is not `allow`, `runTool()`
pushes an `approval` step and **returns** — the call is dropped on the floor.
Nothing is queued, no approver is notified, and the run still reports
`succeeded`.

The contracts to do this properly already exist and are unused:
`RunStatus` includes `"waiting"`, `AgentStepType` includes `"approval"`, and
`PolicyDecision.approval` carries `requiredRole` / `expiresAt` / `channel`. This
cycle is mostly **wiring contracts that were already designed**, not designing
new ones.

### 2. The MCP transport bypasses policy entirely

In `apps/mcp-server/src/server.ts`, only `run_agent` goes through the
orchestrator. `search_memory`, `get_note`, `get_identity`, `get_context`,
`list_workspace`, and `read_file` call memory and workspace directly — no policy
decision, no audit event. The transport surface has weaker guarantees than the
orchestrator it fronts. That is tolerable while everything is read-only and
becomes a real hole the moment writes exist.

### 3. The intelligence core has no automated tests

There are no test files under `packages/` or `apps/`. `pnpm verify` is
`tsc --noEmit` plus a Python doctrine fixture self-test. The repo's only unit
tests are `mstrmnd-os/lib/board-policy.test.ts` and
`apps/board/src/agents/providers/sse.test.ts`.

So `MemoryEngine`, `assembleContext()`, the orchestrator, and the policy
heuristic have zero coverage — including `WorkspaceService.resolveSafe()`, which
is a **security control** (path-escape denial) with no test asserting it holds.

### 4. `mstrmnd-os` does not compile on `main`, and CI cannot see it

Verified on `main` (`d40fd7f`): `pnpm typecheck` in `mstrmnd-os` fails with five
`TS2304` errors — `Cannot find name 'LayoutProps'` / `'PageProps'` in
`app/layout.tsx`, `app/(app)/layout.tsx`, `app/(auth)/layout.tsx`, and the two
auth pages.

Root cause is not a code defect: those are Next.js *generated* route types, and
`tsconfig.json` includes `.next/types/**/*.ts`, which does not exist until
typegen runs. `next typegen && tsc --noEmit` passes cleanly. The `typecheck`
script is simply incomplete.

Root CI never runs it (Node 20 there; `mstrmnd-os` requires Node >= 24), and the
three most recently merged PRs — #37 `vgpu 0.4.0`, #38 `next@16.3.4`,
#39 Geist Pixel fonts — all landed **into that uncovered workspace**, including a
Next minor upgrade. Slice 0 closes this first because every later slice's
evidence depends on gates that actually run.

### 5. Planning is decorative

Step 1 of `Orchestrator.dispatch()` asks the model to "propose brief next tools
as JSON array of `{tool,args}`", stores the reply as a step summary, and never
parses it. Steps 2–4 are hardcoded: search memory, spawn `workspace-scout`,
synthesize. `spawn_subagent` sits in `OPERATOR_AGENT.toolsAllowlist` but is not
implemented as a tool. Swapping `EchoProvider` for a real model changes the prose
in the transcript, not the behaviour of the run.

### 6. Policy is implemented twice, in two runtimes that share nothing

Hermes and MCP boot `@mstrmnd/intelligence-core`; Board and `/field` boot eve
inside `mstrmnd-os`. Policy exists in both — `orchestrator.evaluateToolPolicy()`
(regex heuristic) and `mstrmnd-os/lib/board-policy.ts` (session + prompt size +
daily budget) — with different shapes and two audit sinks
(`.mstrmnd/audit.jsonl` and `.mstrmnd/board-audit.jsonl`). There is no
`@mstrmnd/policy` package. Extracting one is what stops the divergence from
doubling again when writes arrive.

Also noted, deliberately **not** scheduled this cycle: `VectorEngine.embed()`
returns an empty vector; `VisionAgent`, `scanDirectory()`, and `indexPhotos()`
are exported but unwired; `workflows/parallel-council.ts` is a placeholder; the
Researcher's `web_search` appears in the OS roster with no tool file behind it;
Board budget and audit are file-backed and will not survive serverless instance
recycling; `AUTH_SECRET` falls back to an insecure development default.

---

## The cycle

Eight slices. Each one names the components it touches, how invasive the edit is,
and what must be true before it is considered landed. Slices 0–1 are
prerequisites; 2–4 are the gate; 5–6 make it reachable and useful; 7 closes out.

### Slice 0 — Green gates

**Why first:** no later slice can produce trustworthy evidence while a whole
workspace is uncompiled and unwatched.

| | |
|---|---|
| **Touches** | `mstrmnd-os/package.json`, `.github/workflows/ci.yml` |
| **Invasiveness** | Low — one script change, one new CI job |
| **Depends on** | Nothing |

- Change `mstrmnd-os`'s `typecheck` script to `next typegen && tsc --noEmit` so
  generated route types exist before the compiler runs.
- Add an `os` job to CI on **Node 24** with its own pnpm install, keeping
  `mstrmnd-os` out of the root workspace. Run `typecheck`, `lint`, and
  `test:board-policy` there, and drop the root job's one-off
  `tsx --test mstrmnd-os/lib/board-policy.test.ts` step so the OS workspace is
  tested in exactly one place on the right Node version.

**Exit criteria:** CI has three jobs (`verify`, `os`, `board`); `mstrmnd-os`
typecheck passes in CI; a deliberate type error in `mstrmnd-os` fails CI.

*Closes MASTER backlog: "CI typecheck for `mstrmnd-os` on Node 24".*

### Slice 1 — A test harness for the intelligence core

**Why here:** the approval gate is a hard invariant. An invariant with no test is
a comment. This slice buys the ability to *prove* slices 2–6 rather than assert
them.

| | |
|---|---|
| **Touches** | new `packages/intelligence-core/test/**`, root `package.json`, `.github/workflows/ci.yml` |
| **Invasiveness** | Low — additive; no production code changes |
| **Depends on** | Slice 0 |

Use the Node built-in test runner via `tsx --test` — already a dependency, already
the pattern in `mstrmnd-os/lib/board-policy.test.ts`. No new framework.

Seed coverage on what is both load-bearing and currently unguarded:

- `WorkspaceService.resolveSafe()` — `..` traversal, absolute-path escape,
  prefix-collision escape (`/vault-evil` against root `/vault`), unknown mount.
  This is the security control from Finding 3.
- `WorkspaceService.read()` — truncation at the byte cap, directory-vs-file errors.
- `MemoryEngine` — `store()` scope/provenance requirement, `search()` ranking
  order, `get()` by id and by title.
- `evaluateToolPolicy()` — pin the *current* behaviour before changing it, so
  Slice 2 is a visible diff rather than a rewrite.

Add `pnpm test` and fold it into `pnpm verify` so the gate becomes
`typecheck && test && doctrine:ci`.

**Exit criteria:** `pnpm verify` runs tests and passes; every case above is
asserted; a deliberately broken path guard fails the suite.

### Slice 2 — Extract `@mstrmnd/policy`

| | |
|---|---|
| **Touches** | new `packages/policy/`, `packages/schemas` (no breaking change expected), `packages/intelligence-core/src/orchestrator.ts` |
| **Invasiveness** | Medium — new package, one call site replaced |
| **Depends on** | Slice 1 |

Replace the regex with a small declarative rule engine that returns the
`PolicyDecision` already defined in `packages/schemas/src/policy.ts`, and honours
all four outcomes — `allow`, `deny`, `modify`, `require-approval`. Today only
`allow` and `require-approval` are ever produced.

Design constraints, from `.cursorrules` and `AGENTS.md`:

- **Pure and host-agnostic.** Input is `(action, scope, input)`; output is a
  `PolicyDecision`. No filesystem, no network, no SDK imports — this is the
  property that lets `mstrmnd-os` adopt it in Slice 7 and lets it be tested
  exhaustively.
- **Rules are data, not regex.** Tool ids map to stable action ids
  (`workspace.write` → `content.publish`-class), so `CONSEQUENTIAL_ACTIONS` is
  matched by declaration rather than by string suffix accident.
- **Deny by default for unknown consequential actions.** An unrecognized
  write-class action must not fall through to `allow`.
- **No environment bypass.** MASTER says "no env bypass" explicitly; there must be
  no variable that turns the gate off. Tests assert this.

**Exit criteria:** orchestrator calls `@mstrmnd/policy`; unknown write-class
actions produce `deny`; every outcome branch is covered by tests; no env var can
downgrade a `require-approval` to `allow`.

### Slice 3 — The approval state machine

This is the slice where the hard invariant becomes real.

| | |
|---|---|
| **Touches** | `packages/intelligence-core/src/orchestrator.ts`, `packages/schemas/src/run.ts`, new approval store |
| **Invasiveness** | **High** — changes run lifecycle semantics |
| **Depends on** | Slice 2 |

Replace "push a step and return" with a genuine pause:

1. On `require-approval`, persist a pending approval record (decision, action,
   arguments, run id, requested-at, expiry) and set the run to
   `status: "waiting"` — the `RunStatus` value that already exists for this.
2. `dispatch()` returns with the run parked. It must **not** report `succeeded`
   with a dropped tool call, which is today's behaviour.
3. Add explicit `approve(runId, approvalId, actor)` and
   `deny(runId, approvalId, actor, reason)` operations that record the human
   actor and emit `approval.granted` / `approval.denied` audit events.
4. Add `resume(runId)`, which re-checks policy, executes only the approved
   action with the **exact arguments that were approved**, and continues the run.

Two properties need tests because they are the ones that bite in production:

- **Idempotency.** Re-running `resume` on an already-executed approval must not
  perform the action twice — Phase 4's "repeated execution cannot duplicate
  consequential actions".
- **No argument substitution.** Approving a write of file A must not permit a
  write of file B. The approved payload is the contract.

Expiry (`PolicyDecision.approval.expiresAt`) is honoured: an expired approval
cannot be redeemed and must be re-requested.

**Exit criteria:** a run requiring approval parks at `waiting` and persists;
approve → resume executes exactly once; deny → run ends without the action;
double-resume is a no-op; expired approvals are refused; every transition emits
an audit event.

### Slice 4 — Policy-gated workspace writes

| | |
|---|---|
| **Touches** | `packages/intelligence-core/src/workspace-service.ts`, `packages/schemas/src/workspace.ts`, orchestrator tool table |
| **Invasiveness** | Medium |
| **Depends on** | Slice 3 |

Only now does a write path exist, and it can only reach disk through the gate.

- Add a `write_file` tool mapped to a consequential action, so it is
  `require-approval` by construction rather than by regex coincidence.
- Add `WorkspaceService.write()` reusing `resolveSafe()` for path containment,
  and extend `WorkspaceMount` with an explicit access mode. **The vault mount
  stays read-only**; a write to a read-only mount is refused by the service
  itself, independent of policy — defence in depth, so a policy bug is not
  sufficient to mutate the vault.
- **Draft-first.** An approved write lands in a staging mount, not the vault.
  Promotion out of staging is a second, separately-approved action. This is the
  `draft → human approves → publish` shape the invariant describes, and it keeps
  the operator's Obsidian vault safe by default while the path matures.

**Exit criteria:** `write_file` cannot execute without an approval; writes to a
read-only mount are refused at the service layer with the guard tested; a path
escape on write is denied; the vault is unmodified after an approved staging
write; the full sequence appears in `.mstrmnd/audit.jsonl`.

### Slice 5 — Transport parity for MCP and Hermes

An invariant that only holds on one entry path is not an invariant. Finding 2.

| | |
|---|---|
| **Touches** | `apps/mcp-server/src/server.ts`, `apps/hermes/src/index.ts` |
| **Invasiveness** | Medium |
| **Depends on** | Slice 4 |

- Route the direct MCP tools through `@mstrmnd/policy` so every call yields a
  decision and an audit event, not just `run_agent`.
- Expose the approval queue on both transports: `list_approvals`, `approve`,
  `deny` as MCP tools, and `--approvals` / `--approve <id>` / `--deny <id>` on
  the Hermes CLI. Without this the queue exists but no human can reach it, and
  the gate is a deadlock rather than a control.
- Approval decisions must be attributable: record which human actor and which
  transport granted it.

**Exit criteria:** every MCP tool call emits a policy decision; a pending
approval raised by Hermes is visible and actionable from MCP and vice versa; the
approving actor and transport appear in the audit record.

### Slice 6 — Make planning real

| | |
|---|---|
| **Touches** | `packages/intelligence-core/src/orchestrator.ts` |
| **Invasiveness** | Medium |
| **Depends on** | Slice 5 |

Parse the model's proposed `{tool,args}` array and execute the proposals instead
of the hardcoded steps 2–4. This is deliberately **last**: letting a model choose
tool calls is only safe once every call is policy-checked, every consequential
one is gated, and both are tested.

Guardrails: proposals not in `toolsAllowlist` are rejected without execution;
arguments are validated before dispatch; a malformed or non-JSON plan degrades to
the current fixed loop rather than failing the run; bound the number of steps per
run so a pathological plan cannot spin.

Implement `spawn_subagent` as a real tool so `workspace-scout` becomes a genuine
child run with its own scope and allowlist, rather than the inlined directory
listing it is today.

**Exit criteria:** a stub provider returning a known plan drives the exact
corresponding tool calls; out-of-allowlist proposals are rejected and audited;
malformed plans fall back cleanly; step count is bounded; `EchoProvider` runs
still succeed so CI stays deterministic.

### Slice 7 — Converge and document

| | |
|---|---|
| **Touches** | `mstrmnd-os/lib/board-policy.ts`, `docs/MASTER.md`, `docs/portability.md`, `docs/architecture.md` |
| **Invasiveness** | Low–medium |
| **Depends on** | Slice 6 |

- Adopt `@mstrmnd/policy` in `mstrmnd-os` for the Board path so the two runtimes
  share one policy vocabulary and one decision shape, closing Finding 6. The
  package is dependency-free and host-agnostic by design in Slice 2, which is
  what makes this possible across the workspace boundary.
- Converge on one audit event shape across both sinks so runs remain
  reconstructable from a single format.
- Update the MASTER backlog and status stamp; add a `docs/portability.md` ledger
  row for the approval store; refresh `docs/architecture.md`, which is currently
  a four-line sketch that predates the orchestrator.

**Exit criteria:** one policy vocabulary across both runtimes; one audit event
shape; MASTER reflects what landed and what was deliberately deferred, named
accurately as scaffold or shipped.

---

## Definition of done — the demo

The cycle is complete when this sequence runs end to end and the transcript is
reconstructable from the audit log alone:

1. `pnpm hermes --goal "Draft a note summarizing this week's operator priorities"`
2. The model proposes `write_file` (Slice 6 parses it; Slice 2 classifies it
   consequential).
3. The run parks at `status: "waiting"`; nothing is written.
4. `pnpm hermes --approvals` lists the pending write with its exact target path
   and content preview.
5. `pnpm hermes --approve <id>` records the human actor and resumes the run.
6. The file lands **in staging**, not the vault. The vault is byte-identical.
7. `pnpm hermes --approve <id>` again does nothing — no duplicate write.
8. `.mstrmnd/audit.jsonl` contains, in order: `policy.decision`
   (`require-approval`) → `approval.granted` (with actor) → `tool.call` →
   `workspace.write`.
9. The same pending approval is visible and actionable through MCP.
10. `pnpm verify` and all three CI jobs are green.

Step 6 is the one that matters most for trust: **the operator's vault cannot be
modified by an agent in this cycle at all.** Direct vault writes are a later,
separately-approved decision.

---

## Risks

| Risk | Mitigation |
|---|---|
| Slice 3 changes run lifecycle semantics and can silently regress the gate | Slice 1 lands the test harness first; Slice 2 pins current policy behaviour before changing it |
| A policy bug allows an ungated vault write | Read-only mount enforcement in `WorkspaceService` is independent of policy; approved writes go to staging, never the vault |
| Approval replay causes duplicate consequential actions | Idempotency is an explicit Slice 3 exit criterion with a test |
| Model-proposed tool calls escape the allowlist | Slice 6 is sequenced last, behind allowlist checks, argument validation, and a step bound |
| Divergence between the two runtimes grows again | `@mstrmnd/policy` is pure and host-agnostic specifically so both can consume it (Slice 7) |
| Node 20 vs 24 split makes CI brittle | Separate CI job per workspace; `mstrmnd-os` stays out of the root pnpm graph |
| Scope creep into deferred work | The out-of-scope list below is part of the plan, not an afterthought |

---

## Explicitly out of scope

Deferred by decision, not oversight. Starting any of these mid-cycle is scope
creep:

- **PRESS / editorial publish-gate work** — deferred per `AGENTS.md` and MASTER.
  Keep the worker compiling; do not expand it.
- **Direct vault writes and anything auto-publishing.** Staging only this cycle.
- **Board package extraction** (`deliberation`, `agent-roster`, `model-router`,
  `design-tokens`) — MASTER gates this behind the app running intact, and it does
  not block the gate.
- **Vector / semantic recall** (`VectorEngine`, pgvector) — its own slice.
- **`VisionAgent`, `scanDirectory`, `indexPhotos`** — unwired scaffolds; leave them.
- **Multi-tenant isolation and managed deploy** — roadmap Phase 7.
- **Plugin SDK and the onboarding template** — MASTER puts these after Operator
  Zero can write and plan, which is exactly what this cycle delivers.
- **Postgres-backed audit/budget durability for Board** — real (files will not
  survive serverless recycling), but it is a persistence slice, not a gate slice.
- **`AUTH_SECRET` hardening** — worth a small standalone fix; not part of the gate.

---

## Backlog mapping

| MASTER backlog item | Slice |
|---|---|
| Policy-gated workspace writes (draft → human approval → publish; no env bypass) | 2, 3, 4 |
| Richer parent loop: execute model-proposed allowlisted tools (still policy-checked) | 6 |
| CI typecheck for `mstrmnd-os` on Node 24 | 0 |

Two items this plan adds, because the review showed the three above cannot land
safely without them:

| Added item | Slice | Why |
|---|---|---|
| Test harness for `@mstrmnd/intelligence-core` | 1 | A hard invariant with no test is a comment |
| Extract `@mstrmnd/policy` | 2 | Stops policy from being implemented a third time when writes arrive |
