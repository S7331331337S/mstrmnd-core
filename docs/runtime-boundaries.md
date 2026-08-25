# Runtime Boundaries

This document defines the boundary between the canonical MSTRMND knowledge system and the executable runtime.

> Day-to-day agent alignment and backlog: [`MASTER.md`](./MASTER.md).

## Source of Truth

The [`mstrmnd.md`](https://github.com/S7331331337S/mstrmnd.md) repository is authoritative for:

- company philosophy and canon
- positioning and terminology
- commercial doctrine
- intelligence architecture standards
- agent specification standards
- skill and connector standards
- security, governance, evaluation, and observability requirements
- brand and research standards
- product and Company Operating System roadmap

This repository is authoritative for:

- runtime code
- package APIs
- schemas
- adapters
- orchestration behavior
- model routing
- workflows
- policy enforcement
- telemetry implementation
- agent, skill, and connector implementations

## Doctrine Consumption

MSTRMND Core should consume canonical doctrine through a versioned sync mechanism rather than duplicate it manually.

The preferred sequence is:

1. Pin a reviewed `mstrmnd.md` commit SHA or release tag.
2. Sync selected canonical Markdown into a generated local directory.
3. Build a manifest containing source repository, commit, path, checksum, and sync timestamp.
4. Validate required doctrine files in CI.
5. Expose the loaded doctrine through the context layer to approved agents and workflows.

Generated doctrine must not be edited directly in this repository.

## Proposed Generated Layout

```text
.generated/mstrmnd-md/
├── manifest.json
├── company/
├── strategy/
├── commercial/
├── platform/
├── agents/
├── skills/
├── connectors/
├── design/
├── research/
└── roadmap/
```

The generated directory should remain excluded from hand-authored runtime logic. Whether it is committed or generated during setup should be decided when the sync mechanism is implemented.

## Context Precedence

When an agent or workflow assembles context, apply this precedence:

1. non-negotiable safety and platform policy
2. current organization policy
3. current workspace or project policy
4. canonical MSTRMND doctrine
5. role and agent specification
6. task-specific instructions
7. retrieved memory and supporting evidence

Lower-priority context must not silently override higher-priority rules.

## Runtime Domains

### Context

Resolves authoritative, scoped information for a task. Context may include doctrine, company policy, project data, retrieved memory, user instructions, and live system state.

### Memory

Stores and retrieves historical information with explicit provenance, scope, retention, confidence, and access rules.

### Orchestration

Plans and coordinates model calls, agents, tools, skills, workflows, approvals, retries, and fallbacks.

### Models

Providers are interchangeable execution resources selected by capability, risk, latency, cost, and policy.

### Skills

Skills are reusable, versioned procedures with typed inputs, outputs, prerequisites, tests, and failure behavior.

### Tools and Connectors

Tools expose bounded actions. Connectors integrate external systems. Both require explicit permissions, schemas, audit events, and revocation paths.

### Policy

Evaluates whether an action is allowed, requires approval, must be modified, or must be denied. Every workflow must carry a `ThreatBoundary` (network, credentials, tools, filesystem, cost ceiling, consequential approvals, MCP allow-list). Missing boundary is a deny.

### Evaluation

Measures correctness, reliability, policy compliance, cost, latency, human intervention, and business outcomes.

### Observability

Records traces, model calls, retrievals, tool calls, policy decisions, approvals, errors, spend, and outcome metrics.

## Adapter Boundary

Obsidian, local files, Supabase, Google Drive, GitHub, Gmail, Slack, CRMs, and other external systems are adapters. Domain packages must not depend directly on vendor-specific data shapes.

Adapters should translate vendor data into stable MSTRMND schemas and translate approved runtime actions back into vendor calls.

Hosting platforms are adapters on the same terms. Deployment target, sandbox backend, durable-execution engine, and model gateway are execution resources selected at the edge, never dependencies of agents, tools, or schemas. The current couplings and their replacements are tracked in [`portability.md`](./portability.md).

## Identity and Scope

Every consequential runtime object must carry explicit identity and scope fields.

Minimum scope dimensions:

- organization ID
- workspace ID
- user or operator ID
- agent ID
- workflow or run ID
- project or client ID when applicable

Credentials must be scoped more narrowly than the runtime that invokes them whenever possible.

## Consequential Actions

The following actions require a policy decision and usually human approval unless an organization explicitly authorizes a bounded exception:

- sending external communications
- publishing content
- moving money or creating financial commitments
- deleting or irreversibly modifying data
- changing permissions or credentials
- executing production code changes
- entering contracts or legal commitments
- disclosing sensitive information

## Change Governance

When runtime work reveals that doctrine is incomplete or incorrect:

1. Open a doctrine change in `mstrmnd.md`.
2. Review and merge it there.
3. Update the pinned doctrine version in `mstrmnd-core`.
4. Add or update tests proving runtime compliance.

Do not let implementation drift become undocumented policy.
