# Threat boundary

Every MSTRMND workflow must declare a **threat boundary** before it runs.
Missing boundary = do not run. Empty allow-lists are deny-all.

| Field | Fail-closed default |
|---|---|
| `networkAllowlist` | deny-all egress |
| `credentialAllowlist` | none |
| `toolsAllowlist` | named tools only |
| `filesystemScope` | named mounts/prefixes only |
| `costCeilingUsd` | hard cap (Operator Zero: `$1`) |
| `consequentialApprovals` | all `CONSEQUENTIAL_ACTIONS` |
| `mcpAllowlist` | local `mstrmnd` MCP only — blocks shadow MCP |

The orchestrator attaches `run.boundaryId`, emits `policy.boundary` and
`policy.decision` audit events, and will not execute tools outside the
boundary. Write-like and consequential actions `require-approval`.

This is the containment lesson from the August 2026 OpenAI incident: tool-using
systems need network isolation, credential scope, and continuous policy — even
when that costs monitoring overhead.

Operator Zero default is built in `operatorZeroBoundary()` and attached by
`createRuntime()`. Override with `RuntimeConfig.boundary`.
