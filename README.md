# MSTRMND Core

Personal Intelligence Infrastructure.

Models change. Your intelligence layer persists.

## Vision

MSTRMND is a user-owned intelligence layer for memory, identity, visual understanding, autonomous agents, and creative collaboration.

## Core Systems

- Hermes Agent Runtime
- MCP Interface Layer
- Personal Memory Graph
- Multimodal Intelligence
- Creative Intelligence

## Local MVP — Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- An Obsidian vault on disk

### 1. Install

```bash
pnpm install
```

### 2. Configure vault path

Copy the example env file and set your vault location:

```bash
cp .env.example .env
# Edit .env and set OBSIDIAN_VAULT_PATH if not using the default
```

Default vault path: `~/Documents/Obsidian Vault`

### 3. Add identity profile (optional but recommended)

Copy the starter template into your vault:

```bash
cp templates/identity.md "$OBSIDIAN_VAULT_PATH/identity.md"
# Edit values, interests, and preferences to match you
```

### 4. Smoke test — Hermes vault load

```bash
OBSIDIAN_VAULT_PATH="/path/to/your/vault" pnpm --filter @mstrmnd/hermes dev
```

Expected output: note count, identity status, sample titles.

When Hermes runs a plan (`HERMES_GOAL=...`), any file it proposes to write is
staged as a draft under `<vault>/.mstrmnd/drafts/` and published only after the
operator approves it at the prompt — the approval gate is a hard stop and
nothing auto-publishes. A non-interactive run (CI, cron, a pipeline) has no
operator to ask, so it leaves the drafts in place and writes nothing to the
vault. There is deliberately no flag or environment variable that skips this.

### 5. Connect to Cursor via MCP

Add to your Cursor MCP config (`~/.cursor/mcp.json` or project-level):

```json
{
  "mcpServers": {
    "mstrmnd": {
      "command": "pnpm",
      "args": ["--filter", "@mstrmnd/mcp-server", "start"],
      "cwd": "/Users/steele/mstrmnd-core",
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

Restart Cursor. The server exposes three tools:

| Tool | Description |
|------|-------------|
| `search_memory` | Keyword search over note titles, tags, and body |
| `get_note` | Retrieve full note content by path or title |
| `get_identity` | Return your vault-authored identity profile |

### 6. Typecheck

```bash
pnpm typecheck
```

## Optional — iCloud vault map

Generate digest notes from iCloud/local folders into your vault:

```bash
python3 scripts/sync-vault-map.py --dry   # preview
python3 scripts/sync-vault-map.py         # write notes
# or via launchd wrapper:
bash scripts/run-icloud-map.sh
```

## Status

Local MVP: MCP server + full-text memory search + vault identity profile.

Next up: semantic search (embeddings), Hermes agent loop, multimodal vision.

## Generate Architecture PDF

```bash
python -m pip install reportlab
python scripts/generate_arch_spec.py --output /tmp/MSTRMND_Core_Technical_Architecture_Specification.pdf
```
