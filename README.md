# MSTRMND Core

**Executable operational intelligence infrastructure.**

> Models change. The intelligence layer persists.

MSTRMND Core is the runtime implementation of the doctrine defined in [`mstrmnd.md`](https://github.com/S7331331337S/mstrmnd.md).

`mstrmnd.md` defines what MSTRMND believes, how its systems should behave, and the standards every agent, skill, connector, workflow, and client deployment must follow.

`mstrmnd-core` implements those standards in software.

## Canonical Positioning

> MSTRMND installs the intelligence layer between a company's vision and its daily execution.

MSTRMND Core provides the model-agnostic runtime for context, memory, orchestration, skills, tools, governance, evaluation, and continuous learning.

## Repository Relationship

| Repository | Role |
|---|---|
| `mstrmnd.md` | Canonical company doctrine, architecture standards, commercial model, agent specifications, brand rules, research standards, and roadmap |
| `mstrmnd-core` | Executable runtime, packages, adapters, workflows, policies, observability, and agent implementations |

When implementation and doctrine conflict, the current merged version of `mstrmnd.md` is authoritative until an explicit architecture decision updates both repositories.

## Operating Loop

```text
Vision
  ↓
Context + Memory
  ↓
Planning
  ↓
Orchestration
  ↓
Execution
  ↓
Evaluation
  ↓
Learning
  ↺
```

## Current Systems

- Hermes agent runtime
- MCP interface layer
- Obsidian-backed context and memory
- identity profile loading
- ranked memory search
- memory graph construction
- connector workspace package
- multimodal and vision foundations
- creative and editorial intelligence workers

The local-first Obsidian implementation remains an important reference adapter. It is not the boundary of the platform.

## Target Runtime Capabilities

MSTRMND Core is evolving toward:

- company, workspace, user, role, project, and agent context
- model-agnostic provider routing
- persistent memory and knowledge graphs
- agent, skill, tool, and connector registries
- durable workflow orchestration
- policy and permission enforcement
- approval gates for consequential actions
- budget and consumption controls
- evaluations and regression testing
- cost, quality, and business-outcome telemetry
- auditable execution histories
- tenant-aware credentials and data boundaries

## Package Direction

Existing packages should be preserved and progressively aligned with these domains:

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

This list is a target architecture, not a requirement to create empty packages. New packages should be introduced only when they own real behavior and a stable contract.

## Identity and Tenancy

The runtime must generalize identity beyond a single person or vault.

Supported identity scopes should include:

- organization
- workspace
- user
- operator role
- brand
- client
- project
- agent
- workflow

Every memory, credential, policy, tool call, and artifact must carry an explicit scope. Cross-scope access should be denied by default.

See [`docs/runtime-boundaries.md`](docs/runtime-boundaries.md) and [`docs/modernization-roadmap.md`](docs/modernization-roadmap.md).

## Local MVP — Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- an Obsidian vault on disk

### 1. Install

```bash
pnpm install
```

### 2. Configure vault path

```bash
cp .env.example .env
# Set OBSIDIAN_VAULT_PATH if not using the default.
```

Default vault path:

```text
~/Documents/Obsidian Vault
```

### 3. Add an identity profile

```bash
cp templates/identity.md "$OBSIDIAN_VAULT_PATH/identity.md"
```

Edit the profile to reflect the operator's values, interests, preferences, and working context.

### 4. Smoke test Hermes

```bash
OBSIDIAN_VAULT_PATH="/path/to/your/vault" pnpm --filter @mstrmnd/hermes dev
```

Expected output includes note count, identity status, and sample titles.

### 5. Connect through MCP

Add the server to Cursor or another MCP-compatible client:

```json
{
  "mcpServers": {
    "mstrmnd": {
      "command": "pnpm",
      "args": ["--filter", "@mstrmnd/mcp-server", "start"],
      "cwd": "/path/to/mstrmnd-core",
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

The current server exposes:

| Tool | Description |
|---|---|
| `search_memory` | Ranked search over note titles, tags, and content |
| `get_note` | Retrieve note content by path or title |
| `get_identity` | Return the parsed identity profile |

### 6. Typecheck

```bash
pnpm typecheck
```

## Optional iCloud Vault Map

```bash
python3 scripts/sync-vault-map.py --dry
python3 scripts/sync-vault-map.py
# Or:
bash scripts/run-icloud-map.sh
```

## Engineering Rules

- Keep providers replaceable.
- Keep adapters separate from domain logic.
- Define typed contracts before adding agents or tools.
- Require explicit scope for memory and credentials.
- Log every consequential tool call.
- Use approval gates for money, deletion, publishing, external communication, and permission changes.
- Measure cost per successful outcome, not token volume alone.
- Do not create autonomous behavior without evaluation and revocation paths.
- Prefer substantive implementation over placeholder package trees.

## Status

Current state: local MVP with live memory, identity, graph, MCP, connector, and editorial foundations.

Strategy: **Operator Zero first** — dogfood this runtime on MSTRMND’s own work, then productize the same model-agnostic framework for other operators (their context/policies/connectors as configuration, not a fork).

Next state: close Phase 0 (doctrine pin + sync + CI), then generalize schemas/scope and the governed editorial loop while preserving the working local-first path.

**Agents (Claude / GPT / Grok / Copilot / etc.):** read [`docs/MASTER.md`](docs/MASTER.md) before planning or coding.

## Architecture Specification

```bash
python -m pip install reportlab
python scripts/generate_arch_spec.py \
  --output /tmp/MSTRMND_Core_Technical_Architecture_Specification.pdf
```
