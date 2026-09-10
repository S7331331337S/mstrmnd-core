# Operator Zero sprint review — 2026-09-03

**For:** Steele Malone, next sprint kickoff.
**Repo:** [`S7331331337S/mstrmnd-core`](https://github.com/S7331331337S/mstrmnd-core) at `9022885` (`main`).
**Cadence:** this repo does not define a sprint calendar. MASTER prefers small PRs. Last five days shipped Board extract, hosted OS routing, CI repair, and Field/vgpu. This plan is **one week of ranked small PRs**, not a rewrite.

House style: `briefs/` is PRESS JSON (`issue004.json`, `sample_brief.json`). Planning lives in `docs/`. This file does not replace [`MASTER.md`](./MASTER.md).

---

## Verdict: live product, not a stub

`mstrmnd-core` is the **live Operator Zero runtime** (Hermes, MCP plugin, schemas, Board, nested `mstrmnd-os`). It is not a kitchensink starter and not an empty turborepo scaffold.

Sister repos (verified, not assumed):

| Repo | Last activity | What it is |
|---|---|---|
| **`mstrmnd-core` (this)** | 2026-09-02 | Executable intelligence layer. Doctrine pin, working `createRuntime()`, CI, Board, OS host. |
| [`mstrmnd`](https://github.com/S7331331337S/mstrmnd) | 2026-08-29 | Separate commercial web app (Next.js + Supabase + Stripe + eve agents). Same slogan, different stack and contracts. Do not treat as this runtime. |
| [`mstrmnd-turboai`](https://github.com/S7331331337S/mstrmnd-turboai) | 2025-08-08 (single “Initial commit”) | README is one line (`mstr build dev`). No `package.json`. **That** is the old stub. |
| [`mstrmnd.md`](https://github.com/S7331331337S/mstrmnd.md) | pinned here at `7db4af9` | Doctrine only. |

GitHub reports **0 open issues** on this repo. Priorities live in `docs/MASTER.md`, README, and open PRs — not an issue tracker.

---

## 1. Structure map

Three install graphs, not one:

```text
root pnpm workspace          nested pnpm workspace         isolated npm app
(apps/* + packages/*         mstrmnd-os/                   apps/board
 minus apps/board)           (own lockfile, Node >=24)
        │                            │                            │
        ├── @mstrmnd/hermes          Next + eve Maestro           Expo SDK 57
        ├── @mstrmnd/mcp-server      /api/board/complete          hosted | demo engines
        ├── @mstrmnd/intelligence-core
        ├── @mstrmnd/schemas
        ├── @mstrmnd/connectors
        └── @mstrmnd/agents (scaffold)
```

### Root workspace (`pnpm-workspace.yaml`)

| Package | Role | Depends on | Maturity |
|---|---|---|---|
| `@mstrmnd/schemas` | Shared types: scope, provenance, policy, context, workspace, run | none | Real contracts (~365 lines). No scripts. |
| `@mstrmnd/connectors` | Obsidian vault reader; filesystem `readdir`; photos stub | none | Obsidian path is real. `scanDirectory` / `indexPhotos` are thin. |
| `@mstrmnd/intelligence-core` | Memory, context pack, workspace (read), orchestrator, `createRuntime()`, Echo + OpenAI-compatible providers | schemas, connectors | The runtime (~1685 lines). No package scripts. |
| `@mstrmnd/agents` | Re-exports `VisionAgent` | schemas, intelligence-core | Scaffold. **No app imports it.** `VectorEngine.embed()` returns `[]`. |
| `@mstrmnd/hermes` | CLI: boot runtime, dispatch `operator-agent` | intelligence-core, schemas | Shipped shell. Script: `dev` only. |
| `@mstrmnd/mcp-server` | stdio MCP: memory, identity, context, workspace list/read, list/run agents | intelligence-core, schemas, MCP SDK | Shipped plugin. No write tool. |

Root `tsconfig.json` includes `apps` + `packages`, **excludes** `apps/board`. Root `pnpm build` / `typecheck` is `tsc --noEmit` over that graph — not `turbo build`.

### Isolated / nested (not in the root turbo graph)

| Surface | Role | How it couples |
|---|---|---|
| `apps/board` | Expo decision-room. Seven specialists + Chair. Offline demo + hosted engine. | Intentionally `!apps/board` in pnpm workspace. Own npm lockfile, materialized from skills pin `a74d2c9`. Live rooms call `mstrmnd-os` `/api/board/complete`. No `@mstrmnd/*` imports. |
| `mstrmnd-os/` | Next.js 16.3 host + eve Maestro, Third-Mind, Field (`/field`), Board policy/budget/audit. Own `pnpm-workspace.yaml`. | **Not** in root workspace or root tsconfig. Does not import intelligence-core. Parallel model stack (`agent/lib/model.ts`). |

### Notable top-level dirs

| Path | Owns |
|---|---|
| `docs/` | Agent brief (`MASTER.md`), portability ledger, doctrine contract, this sprint review. |
| `briefs/` | PRESS editorial JSON. Out of sprint focus. |
| `templates/` + `templates/operator-pack/` | Identity/company/operator markdown + `pnpm operator:init` pack. |
| `scripts/` | Doctrine sync/validate, operator-pack init, vault map. |
| `fixtures/doctrine-min/` | CI fixture for `pnpm doctrine:ci`. |
| `infrastructure/` | `docker-compose.yml` (postgres/neo4j/minio sketch) and `docker-compose.self-host.yml` (OS + pgvector). |
| `editorial_worker.py` | PRESS HTTP worker (`/render` `/stage`). Deferred. |
| `doctrine.pin.json` | Active pin to `mstrmnd.md` @ `7db4af9`. |
| `.github/workflows/` | `ci.yml` + bounded `codex-ci-repair.yml`. No `CODEOWNERS`. |

### Runtime data flow (what actually boots)

```text
Hermes CLI  ─┐
             ├─ createRuntime() ─ MemoryEngine + WorkspaceService + assembleContext()
MCP stdio   ─┘                   └─ Orchestrator (operator-agent + workspace-scout)
                                      EchoProvider default; openai-compatible when env set

Board (Expo) ── sign-in ──► mstrmnd-os /api/auth/* + /api/board/complete
                            (policy, budget, audit, model hints) ──► eve / AI SDK
```

Two brains: **intelligence-core** (Hermes/MCP) and **eve in mstrmnd-os** (Alliance UI, Board hosted turns). They do not share packages today. That is a coupling finding, not a merge task for this sprint.

---

## 2. Graph health

### Turbo is decorative

`turbo.json` defines only `build` and `dev`. Workspace packages except Hermes/MCP/Board/OS have **empty `scripts`**. Root `pnpm dev` is `turbo dev` (Hermes + MCP). Root `pnpm build` bypasses turbo and runs `tsc --noEmit`.

Missing pipeline tasks relative to a real turborepo: no workspace `typecheck`, `test`, or `lint` tasks; no `^typecheck` graph. This does **not** block a product sprint if CI keeps calling the root scripts. Do not spend the week inventing empty package scripts.

### CI (`.github/workflows/ci.yml`)

| Job | What it runs | Gap |
|---|---|---|
| `verify` | `pnpm typecheck`, `tsx --test mstrmnd-os/lib/board-policy.test.ts`, `pnpm doctrine:ci`, live doctrine sync when pin is `active`, Hermes `--dry-run` | Does **not** typecheck `mstrmnd-os`. Does **not** lint. Intelligence-core has no unit tests in CI. |
| `board` | materialize vendor → `npm ci` → typecheck → bun SSE tests | Does not run `export:web`. |

`codex-ci-repair.yml` is landed (#23). Needs `OPENAI_API_KEY` Actions secret; human review still required.

### Duplicate / dead / thin

| Finding | Evidence |
|---|---|
| `@mstrmnd/agents` unused | Grep: only `packages/agents` and MASTER target-shape mention. |
| Connectors stubs | `filesystem/scanner.ts` is `readdir`; `photos/indexer.ts` maps paths. |
| `VectorEngine` empty | `embed()` returns `{ vector: [] }`. |
| Dual model providers | intelligence-core `model-provider.ts` vs `mstrmnd-os/agent/lib/model.ts`. |
| Dual compose files | `infrastructure/docker-compose.yml` (neo4j/minio, unused by current runtime) vs self-host OS stack. |
| `devDependencies: "latest"` | Root `turbo`, `typescript`, `tsx`, `@types/node` unpinned. Reproducibility risk. |
| Node split | Root CI Node **20**. `mstrmnd-os` engines **>=24**. Local agent Node here is 22. |

### Tests in tree

Only two automated test files: `mstrmnd-os/lib/board-policy.test.ts`, `apps/board/src/agents/providers/sse.test.ts`. Workspace writes, orchestrator, MCP, and path-escape have **no tests on `main`**.

### Env / docs gaps that will slow a sprint

- README **Status** still says “Deferred: … real model providers beyond Echo.” MASTER “Current reality” and PR #11 already landed `openai` / `openai-compatible`. CI default remains `echo`.
- MASTER **Deferred** still lists “Workspace write tools” *and* “Real model providers beyond EchoProvider” as “do not start unless asked,” while the **status stamp** (2026-09-01) says **Next: Policy-gated workspace writes; richer agent planning**. Sprint must pick the status stamp; H0 is to reconcile the file so agents stop forking.
- `.env.example` documents both runtimes; Node apps do not auto-load `.env` (AGENTS.md).
- `OBSIDIAN_VAULT_PATH` required for a meaningful Hermes/MCP dogfood; CI dry-run allows missing vault.
- Board needs `EXPO_PUBLIC_MSTRMND_API_URL` + OS `AUTH_SECRET` / `DATABASE_URL` for live rooms.
- Zero GitHub issues: work will be lost if it is not in MASTER or a PR.

---

## 3. Priority sources (not invented)

### MASTER (authoritative for near-term)

Landed: doctrine pin, context pack, workspace **read**, Hermes parent+scout, `createRuntime`, MCP tools, operator pack, host portability, vgpu/Field, Board import + hosted routing, CI repair.

**Explicit next:** policy-gated workspace writes; richer agent planning.

**Explicitly deferred:** PRESS publish-gate, brand/Signal wiring, multi-tenant managed deploy, empty packages, **plugin/template before Operator Zero can write+plan**.

Board extract of `packages/deliberation` etc. is marked **later**.

### Recent `main` commits (through 2026-09-02)

Board extract (#18) → hosted OS provider (#20) → Expo fork sync note (#22) → Codex CI repair (#23) → vgpu tools + Field (#17). Product motion is **Board hosted on OS** plus **OS Field demo**, not PRESS and not plugin SDK.

### Open PRs (as of 2026-09-03) — triage, do not merge blindly

| PR | State | Sprint action |
|---|---|---|
| [#25](https://github.com/S7331331337S/mstrmnd-core/pull/25) MASTER plan | open, **dirty** vs main | MASTER already on `main`. Close as superseded. |
| [#19](https://github.com/S7331331337S/mstrmnd-core/pull/19) Board extract (pnpm-in-workspace variant) | open, unstable | **Superseded by merged #18** (isolated npm). Close. #26/#28 target this branch — close with it. |
| [#13](https://github.com/S7331331337S/mstrmnd-core/pull/13) OS Slice 1 | open, stale (Aug 16) | OS is already on `main`. Close. |
| [#7](https://github.com/S7331331337S/mstrmnd-core/pull/7) doctrine sync | open draft | Doctrine pin/CI already on `main`. Close. |
| [#3](https://github.com/S7331331337S/mstrmnd-core/pull/3) plugin SDK + onboarding | open, bases on **Aug 4** main | Contradicts MASTER: plugin after Operator Zero. Do **not** merge this week. |
| [#24](https://github.com/S7331331337S/mstrmnd-core/pull/24) path-escape + write approval | draft **into #3**, not main | Steal the **pattern** (component-wise path compare, draft→approve writes, `node:test`) onto `main`. Do not merge via #3. |
| [#16](https://github.com/S7331331337S/mstrmnd-core/pull/16) threat boundary + skill adapter | open, 48 files / +2302 | Aligns with “stronger policy” but is a bulk ingest. Slice, don’t land whole. |
| [#26](https://github.com/S7331331337S/mstrmnd-core/pull/26) / [#28](https://github.com/S7331331337S/mstrmnd-core/pull/28) Board EngineKind | drafts on #19 | `main` already uses `hosted` \| `demo` (#20). Close with #19. |

---

## 4. Findings (ranked by sprint impact)

1. **MASTER disagrees with itself** on workspace writes and model providers. Agents will thrash until Deferred vs status stamp is one list.
2. **Workspace is read-only on `main`.** `WorkspaceService` has list/read/stat + `..` denial. Orchestrator regex-flags write-like tool ids as `require-approval`, but no write tool exists. MCP has `read_file` only.
3. **Orchestrator is a fixed four-step loop** (plan → memory search → one scout handoff → synthesize). Matches MASTER “thin / next.”
4. **Policy is a schema + a regex**, not an engine. Board has a real gate (`decideBoardPolicy`) with tests. Intelligence-core does not reuse it.
5. **Stale PRs will collide** with any write/policy work (#3/#16/#19/#24).
6. **`mstrmnd-os` is off the verify graph.** A type error there will not fail `pnpm verify`.
7. **Turbo/pnpm “latest” pins** and Node 20/24 split are the main env foot-guns.

---

## 5. Recommended one-week backlog

Owner of product calls: **Steele Malone**. Implementation: whoever is on the repo this week (human or agent). Surfaces listed per item.

### H0 — Unblock (half day, docs/PR hygiene only)

**Reconcile MASTER + close superseded PRs.**

- Status stamp remains source of “Next.”
- Move “workspace write tools” **out** of Deferred (or rewrite Deferred to “un-gated / auto-publish writes”).
- Strike or qualify “Real model providers beyond EchoProvider” (landed; default still echo).
- Align README Status with MASTER Current reality.
- Close #25, #19, #13, #7, #26, #28 with a one-line “landed on main via …” comment.

**Acceptance:** MASTER Deferred and Next do not contradict. README Status does not claim Echo-only. Stale PRs closed or explicitly parked.

### P0 — Policy-gated workspace writes on `main`

**Why:** MASTER status stamp; Hermes/MCP cannot edit operator files; #24 already designed the gate but on the wrong base.

**Surfaces:** `packages/intelligence-core` (`WorkspaceService`, `Orchestrator.evaluateToolPolicy`), `apps/mcp-server` (`write_file`), `apps/hermes` (approval prompt). Reuse Board’s “nothing consequential without a session/approval” idea; do not import eve.

**Port from #24, do not merge #3:** path comparison on components (no `startsWith` prefix escape); drafts under `.mstrmnd/drafts/`; interactive `y/yes`; non-interactive refuses; no env flag that disables the gate.

**Acceptance:**

- `WorkspaceService` can write only inside a mount; `../` and sibling-prefix paths throw `WorkspacePathError`.
- MCP `write_file` exists, returns a draft id, does not mutate the vault until approval.
- Hermes dry-run and CI never write the vault.
- `node:test` (or existing `tsx --test`) covers escape + refuse-without-approval. `pnpm verify` still green.
- MASTER checkbox: workspace writes **behind policy** marked done; PRESS still deferred.

### P1 — Richer parent loop (one extra planning step, not a new package)

**Why:** MASTER Next; current loop ignores the model’s JSON tool list and always searches memory + scouts once.

**Surfaces:** `packages/intelligence-core/src/orchestrator.ts` only. Do **not** create `@mstrmnd/orchestrator`.

**Acceptance:**

- Parent executes **model-proposed** allowlisted tools (still policy-checked) instead of a hardcoded sequence.
- Unknown / denied tools become `deny` or `require-approval` steps on `RunState`.
- Dry-run still succeeds in CI with EchoProvider.
- `workspace-scout` remains the only sub-agent unless a second spec is registered with tests.

### P2 — Put `mstrmnd-os` on the verify path (minimal)

**Why:** Board live path and Field live in OS; CI only runs `board-policy.test.ts` from that tree.

**Surfaces:** `.github/workflows/ci.yml`, `mstrmnd-os` `typecheck` script (already exists).

**Acceptance:**

- CI job or step runs `pnpm --dir mstrmnd-os typecheck` on Node **24** (match `engines`).
- Do not fold `mstrmnd-os` into the root pnpm workspace this week.
- Document in MASTER that Hermes/MCP and eve OS are two runtimes until a later adapter slice.

### P3 — Policy slice from #16 (optional if P0/P1 slip)

**Why:** MASTER “stronger policy enforcement”; #16 is the only open PR that adds a mandatory threat boundary.

**Do:** extract a `ThreatBoundary` (or equivalent) type + fail-closed attach on `Orchestrator.createRun`. Hermes prints it.

**Do not:** land skill-adapter / A2A / SCM connectors / campaign intelligence as part of the same PR.

**Acceptance:** missing boundary fails closed in a unit test; Hermes dry-run prints the boundary; #16 left open or reduced, not force-merged.

---

## 6. Structural hygiene — only if it unblocks

Do **not** restructure the monorepo this sprint.

Allowed tiny follow-ups, only if P0/P2 need them:

- Pin root `turbo` / `typescript` / `tsx` (stop `latest`) when a typecheck flakes.
- Add a root `test` script that runs `tsx --test` over intelligence-core + board-policy (mirrors CI). Skip inventing per-package turbo `test` tasks.
- Ignore `infrastructure/docker-compose.yml` (neo4j/minio) until something reads those services.

Not this week: turbo `lint` pipeline, extracting Board packages, merging `mstrmnd-os` into the root workspace, `@mstrmnd/plugin` from #3.

---

## 7. Out of scope (MASTER)

- PRESS `/render` → approve → `/stage`, Signal-on-publish, brand-kit pixel gates.
- Empty `@mstrmnd/context` / `memory` / `orchestrator` package trees (behavior already lives in intelligence-core).
- Multi-tenant managed deploy.
- Broad autonomy without scoped runs.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Agent reads Deferred and refuses P0 | H0 first. |
| #3/#16 merge during the week | Close or label “parked — plugin after writes.” |
| Path-escape bugs | Tests from #24 on **main** WorkspaceService, not a new WorkspaceManager. |
| Node 24 OS typecheck fails on CI Node 20 | Separate OS job with `node-version: 24`. |
| Dual runtime confusion | Name both in MASTER; do not “unify” this week. |
| No GitHub issues | File issues for P0–P2 or keep this brief + MASTER as the tracker. |

---

## Evidence

- Workspace layout: `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `tsconfig.json`, `mstrmnd-os/package.json`, `apps/*/package.json`, `packages/*/package.json`.
- Line counts (`.ts`/`.tsx`, excluding `node_modules`): schemas 365, intelligence-core 1685, connectors 126, agents 36, hermes 110, mcp-server 352, board 3996, mstrmnd-os 3313.
- CI: `.github/workflows/ci.yml`, `codex-ci-repair.yml`.
- Priorities: `docs/MASTER.md` (aligned 2026-09-01), `README.md`, `AGENTS.md`.
- GitHub: 0 open issues; PRs #3, #7, #13, #16, #19, #24, #25, #26, #28 open; `main` through #17/#23.
- Sister repos: `mstrmnd` README (Next/Supabase/Stripe); `mstrmnd-turboai` single initial commit, no package.json.
