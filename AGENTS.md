# AGENTS.md — MSTRMND Core

**Executable, model-agnostic agent intelligence layer.**

Models change. The intelligence layer persists.

> Before planning or coding, read [`docs/MASTER.md`](docs/MASTER.md).
> That file is the shared brief for Claude, GPT, Grok, Copilot, and every other agent in this repo.

## What this repo is

`mstrmnd-core` implements the runtime for MSTRMND — context, memory, orchestration, skills, tools, connectors, policy, evaluation, and learning.

Canonical doctrine lives in [`mstrmnd.md`](https://github.com/S7331331337S/mstrmnd.md). This repo executes it.

### Operator Zero strategy

1. **Build for ourselves first** — company/operator context, workspace files, Hermes orchestrator, agents/sub-agents, doctrine-backed intelligence.
2. **Ship as a transportable plugin** — same layer loads into hosts (MCP first, then other harnesses).
3. **Then template** — onboard other operators onto any supported harness without forking core.

**Deferred:** PRESS / editorial publish-gate work — do not expand unless explicitly requested.

Do not invent empty platform packages before Operator Zero context + orchestrator are real.

## Stack & tooling

- **pnpm 10+ / Node 20+ / turbo monorepo.** Use pnpm, never npm.
- Drive via turbo + pnpm filters from the repo root — do not cd into packages ad-hoc.

## Common commands (run from repo root)

- `pnpm install` — install workspace deps
- `pnpm dev` — `turbo dev` (all packages)
- `pnpm typecheck` / `pnpm build` — `tsc --noEmit` (verify gate; run before declaring done)
- `pnpm --filter @mstrmnd/hermes dev` — Hermes vault smoke / runtime shell
- `pnpm --filter @mstrmnd/mcp-server start` — MCP server (`search_memory`, `get_note`, `get_identity`)

## Layout

- `apps/`, `packages/` — workspaces (`packages/connectors` is the connector package; no root `connectors/`)
- `briefs/` — editorial input briefs · `kits/` — generated editorial kits (gitignored) · `templates/` — vault templates (e.g. `identity.md`)
- `editorial_worker.py` — PRESS editorial HTTP worker
- `docs/MASTER.md` — **shared agent master plan + backlog**
- `scripts/` — vault/sync utilities · `infrastructure/` — deploy sketches

## Obsidian vault dependency

- Vault path via `OBSIDIAN_VAULT_PATH` (default `~/Documents/Obsidian Vault`) in process env / MCP config.
  Copy from `.env.example` for local notes; Node apps do not currently auto-load `.env`.
- Smoke test: `OBSIDIAN_VAULT_PATH="$HOME/Documents/Obsidian Vault" pnpm --filter @mstrmnd/hermes dev`
- Optional iCloud vault map: `python3 scripts/sync-vault-map.py --dry` then without `--dry`.

Local Obsidian is a **first-party adapter**, not the boundary of the platform.

## HARD invariants

- **Human-Approval gate is a hard stop.** Autonomous flow = draft → user approves →
  publish. Nothing auto-publishes. Ping Signal on publish when that path exists.
  (MSTRMND // PRESS editorial engine is the reference consequential workflow.)
- **Editorial brand — ONE accent only:** Platinum `#e8e2d0` (RGB 232,226,208) over
  obsidian `#0a0a0b`. No second hue. Electric Cyan `(0,200,225)` was a P0 brand reject;
  the Hermes skill engine (`generate_issue_kit.py`) is fixed to Platinum-only — do not
  reintroduce cyan/teal/blue as an accent. Regression guard: `verify_issue_kit.py` must
  assert platinum present and cyan/teal/blue pixel windows ≈ 0 on every kit.
- **Model-agnostic:** providers are replaceable; do not couple domain logic to one vendor.
- **Adapters at the edge:** Obsidian and other vendors translate into stable schemas.
- **Doctrine pinned:** never depend on an unpinned floating doctrine branch at runtime.
  Pin lives in `doctrine.pin.json`. Sync with `pnpm doctrine:sync`; validate with
  `pnpm doctrine:validate` / `pnpm doctrine:ci`. See `docs/doctrine-integration.md`.
- Visual identity cross-check: `~/Downloads/mstrmnd-marketing-dashboard/BRAND.md`
  (Platinum-only, no rockets, real-world monochrome industrial photo, Stripe/Linear
  schematics) when that file is available locally.

## Multi-agent rules

- Update `docs/MASTER.md` backlog checkboxes when you complete or intentionally defer work.
- Prefer small PRs that advance one backlog item.
- Preserve the working vault → memory → MCP path unless the PR migrates it deliberately.
- Name reality accurately in docs (scaffold vs shipped).
- `pnpm typecheck` before done.

## Git

- This is its own git repo (`mstrmnd-core/.git`). Commit normally from the repo root.
- Do NOT use relative paths into `~/` (unlike the dashboard, which lives inside the home repo).
