# Operator pack

Bootstrap a new operator without forking `mstrmnd-core`.

## Setup

```bash
# From mstrmnd-core root:
pnpm operator:init --dir ../my-operator

# Or copy this folder manually, then:
export OBSIDIAN_VAULT_PATH="/absolute/path/to/my-operator"
pnpm doctrine:sync          # if .generated missing
pnpm hermes -- --goal "Summarize operator context" --dry-run
```

## Cursor MCP

Point `cwd` at `mstrmnd-core` and `OBSIDIAN_VAULT_PATH` at this pack (or your vault):

See `mstrmnd.host.json` for a full example.

## Files

| File | Role |
|---|---|
| `company.md` | Company / business context |
| `operator.md` | Operator profile |
| `identity.md` | Identity preferences |
| `boundary.json` | **Executable.** `ThreatBoundary` every run from this pack runs under — tools, mounts, egress, credentials, spend cap, approvals |
| `agent-graph.json` | Descriptive today: default parent + sub-agent ids (runtime still uses built-in specs) |
| `mstrmnd.host.json` | Host/plugin wiring example (descriptive, not loaded) |

## Boundary

`createRuntime()` (Hermes, MCP, HTTP host) loads `boundary.json` from the
operator pack directory — `MSTRMND_OPERATOR_PACK` if set, otherwise
`OBSIDIAN_VAULT_PATH`. Hermes prints `source=pack` when it is in effect.

- No `boundary.json` → the Operator Zero default applies (deny-all egress).
- Present but malformed or structurally invalid → the runtime refuses to
  boot. A broken pack never silently runs under a different boundary.
- `model.complete` is always allowed as a tool id; egress is still governed
  by `networkAllowlist` / `credentialAllowlist`.
- Workspace writes stay draft → human approval → publish regardless of the
  boundary. There is no field that disables that gate.

To use a remote model from a pack, add the provider hostname to
`networkAllowlist`, `"model-api-key"` to `credentialAllowlist`, and set
`MSTRMND_MODEL_CALL_BUDGET_USD` so each call reserves against `costCeilingUsd`.
