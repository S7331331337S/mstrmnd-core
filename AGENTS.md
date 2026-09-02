# AGENTS.md — MSTRMND Core

Personal Intelligence Infrastructure. Models change; the intelligence layer persists.

## Stack & tooling
- **pnpm 10+ / Node 20+ / turbo monorepo.** Use pnpm, never npm.
- Drive via turbo + pnpm filters from the repo root — do not cd into packages ad-hoc.

## Common commands (run from repo root)
- `pnpm install` — install workspace deps
- `pnpm dev` — `turbo dev` (all packages)
- `pnpm typecheck` / `pnpm build` — `tsc --noEmit` (this is the verify gate; run before declaring done)
- `pnpm --filter @mstrmnd/hermes dev` — Hermes agent runtime
- `pnpm --filter @mstrmnd/mcp-server start` — MCP server (tools: `search_memory`, `get_note`, `get_identity`)

## Layout
- `apps/`, `packages/`, `connectors/` — workspaces
- `briefs/` — editorial input briefs · `kits/` — generated editorial kits · `templates/` — vault templates (e.g. `identity.md`)
- `editorial_worker.py` — editorial pipeline worker (drives the MSTRMND // PRESS engine)
- `scripts/` — vault/sync utilities (e.g. `sync-vault-map.py`) · `infrastructure/` — deploy/config

## Obsidian vault dependency
- Vault path via `OBSIDIAN_VAULT_PATH` (default `~/Documents/Obsidian Vault`) in `.env`
  (copy from `.env.example`). 
- Smoke test: `OBSIDIAN_VAULT_PATH="$HOME/Documents/Obsidian Vault" pnpm --filter @mstrmnd/hermes dev`
- Optional iCloud vault map: `python3 scripts/sync-vault-map.py --dry` (preview) then without `--dry` (write).

## HARD invariants
- **Human-Approval gate is a hard stop.** Autonomous flow = draft → user approves →
  publish. Nothing auto-publishes. Ping Signal on publish. (MSTRMND // PRESS editorial
  engine here is the execution layer.)
- **Editorial brand — ONE accent only:** Platinum `#e8e2d0` (RGB 232,226,208) over
  obsidian `#0a0a0b`. No second hue. Electric Cyan `(0,200,225)` was a P0 brand reject —
  do not reintroduce cyan/teal/blue as an accent. Regression guard: `verify_issue_kit.py`
  asserts platinum present and cyan/teal/blue pixel windows ≈ 0 on every kit.
  - ⚠️ **The engine does NOT currently pass this guard.** A fresh `sample_brief.json`
    render trips ~9950 cyan hits against a max of 27, and the cyan-heavy assets
    (quote cards, carousels, cover, linkedin/x) carry ~0 platinum while the
    schematic assets (architecture, timeline, comparison) are clean at 0% cyan.
    So `generate_issue_kit.py` is **not** yet fixed to Platinum-only, despite
    earlier notes here saying so. Fixing it lives in the Hermes skill, outside
    this repo: `~/.hermes/skills/creative/editorial-brand-system/scripts/`.
  - `editorial_worker.py` runs the guard on every `/render` and `/stage` and returns
    it as `brand_qa`. It is **advisory by default** so the pipeline still runs;
    set `EDITORIAL_BRAND_ENFORCE=1` to make a violation fail the render and block
    staging (per-call override: `force:true`). Flip it on once the engine is fixed.
- Visual identity source of truth: `~/Downloads/mstrmnd-marketing-dashboard/BRAND.md`
  (Platinum-only, no rockets, real-world monochrome industrial photo, Stripe/Linear
  schematics). Cross-check generated assets there.

## Git
- This is its own git repo (`mstrmnd-core/.git`). Commit normally from the repo root.
  Do NOT use relative paths into `~/` (unlike the dashboard, which lives inside the home repo).
