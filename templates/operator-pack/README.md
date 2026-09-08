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

Writes never touch the vault. A live run that calls `draft_write` pauses as `waiting`. Then:

```bash
pnpm hermes -- --show <runId>
pnpm hermes -- --approve <runId>   # copies .mstrmnd/drafts/<runId> → .mstrmnd/staging/<runId>
pnpm hermes -- --reject <runId>    # keeps drafts; staging unchanged
```

There is no environment-variable bypass. MCP exposes the same gate as `approve_run` / `reject_run`.

## Cursor MCP

Point `cwd` at `mstrmnd-core` and `OBSIDIAN_VAULT_PATH` at this pack (or your vault):

See `mstrmnd.host.json` for a full example.

## Files

| File | Role |
|---|---|
| `company.md` | Company / business context |
| `operator.md` | Operator profile |
| `identity.md` | Identity preferences |
| `agent-graph.json` | Default parent + sub-agent ids |
| `mstrmnd.host.json` | Host/plugin wiring example |
