# MSTRMND Core Modernization Roadmap

## Objective

Evolve the working local-first MVP into the executable operational intelligence runtime described by `mstrmnd.md` without discarding the parts that already work.

## Guiding Rule

Do not rewrite the repository around an abstract target architecture. Extract stable domains from current behavior, preserve compatibility, and add governance before autonomy.

## Phase 0 — Alignment

- Treat `mstrmnd.md` as canonical doctrine.
- Maintain an explicit repository boundary.
- Add a pinned doctrine reference and sync manifest.
- Map existing packages to target runtime domains.
- Document known gaps and technical debt.

Exit criteria:

- every contributor can explain which repository owns doctrine and which owns implementation
- CI can identify the doctrine version used by the runtime

## Phase 1 — Stable Schemas and Scope

- Define organization, workspace, user, role, brand, client, project, agent, workflow, and run identities.
- Add explicit scope and provenance to memory nodes, artifacts, tool calls, and audit events.
- Generalize the existing identity model without breaking personal identity loading.
- Create stable domain schemas independent of Obsidian and other vendors.

Exit criteria:

- no new memory or artifact can be created without scope and provenance
- the existing local vault path still works

## Phase 2 — Context and Memory Separation

- Separate context assembly from memory persistence.
- Promote Obsidian and filesystem behavior into adapters.
- Add retrieval contracts supporting keyword, graph, and semantic search.
- Implement source confidence, recency, retention, and access metadata.
- Add a company knowledge source alongside personal identity.

Exit criteria:

- Hermes can assemble context from multiple scoped sources
- adapters can be replaced without changing domain logic

## Phase 3 — Registries

Implement versioned registries for:

- agents
- skills
- tools
- connectors
- models
- policies
- workflows

Each registry record should include ownership, version, schema, permissions, dependencies, status, and tests.

Exit criteria:

- runtime capabilities are discoverable and addressable by stable IDs
- disabled or revoked capabilities cannot be invoked

## Phase 4 — Orchestration and Durable Workflows

- Introduce a typed run state model.
- Support deterministic steps, model steps, tool steps, approval steps, and evaluation steps.
- Add retries, timeouts, idempotency, cancellation, and resumability.
- Separate planning from execution.
- Add model fallback and routing policies.

Exit criteria:

- an interrupted workflow can resume safely
- repeated execution cannot duplicate consequential actions

## Phase 5 — Policy, Security, and Budgets

- Add least-privilege credential handling.
- Introduce allow, deny, modify, and require-approval policy outcomes.
- Add action budgets for model spend, tool calls, duration, and retries.
- Add explicit approval gates for consequential actions.
- Implement emergency revocation and run termination.

Exit criteria:

- every consequential tool call has an auditable policy decision
- operators can stop a run and revoke access immediately

## Phase 6 — Evaluation and Observability

- Add structured traces spanning retrieval, models, planning, policies, tools, approvals, and outputs.
- Build offline evaluation datasets for memory retrieval, tool selection, policy compliance, and output quality.
- Track cost per successful outcome, intervention rate, latency, error rate, rollback rate, and business KPI impact.
- Add regression gates before changing models, prompts, skills, or connectors.

Exit criteria:

- runtime changes can be compared against a known baseline
- failures can be reconstructed from trace data

## Phase 7 — Multi-Tenant Runtime

- Enforce organization and workspace isolation.
- Separate tenant credentials, data, policies, indexes, and budgets.
- Add tenant-aware storage and queue infrastructure.
- Define deployment profiles for local, single-tenant managed, and multi-tenant managed operation.

Exit criteria:

- cross-tenant access tests pass by default
- one tenant can be exported or deleted without affecting another

## Phase 8 — Productized Operator Infrastructure

- Operator dashboard for workflows, costs, approvals, outcomes, and incidents.
- Company systems map and capability inventory.
- Managed deployment templates for Revenue Operations, Creative Intelligence, Engineering Intelligence, and Executive Intelligence.
- Client onboarding and doctrine customization workflow.

Exit criteria:

- MSTRMND can deploy a repeatable client system without forking the runtime
- client-specific behavior is configuration, doctrine, skills, policies, and adapters—not hard-coded branches

## Existing Asset Mapping

| Existing asset | Direction |
|---|---|
| Hermes runtime | evolve into the primary operator/runtime shell |
| MCP server | retain as a protocol interface; add auth, scope, policy, and registry integration |
| MemoryEngine | split persistence, retrieval, graph, and ranking behind stable contracts |
| GraphEngine | retain and extend with provenance, typed relationships, and tenant scope |
| Identity loader | generalize into scoped identity/context providers |
| Obsidian vault reader | retain as a first-party local adapter |
| Connectors package | evolve toward the connector standard and registry |
| Schemas package | make the canonical runtime contract package |
| Vision and editorial agents | use as reference implementations for the agent and skill standards |
| PRESS worker | integrate into governed creative workflows rather than operating as an isolated pipeline |

## Near-Term Backlog

1. Add `MSTRMND_DOCTRINE_REF` and a manifest schema.
2. Implement a doctrine sync script against `mstrmnd.md`.
3. Add organization/workspace scope to schemas.
4. Extract Obsidian interfaces from memory domain logic.
5. Define agent, skill, tool, and connector registry schemas.
6. Introduce an audit-event schema.
7. Add a policy decision contract.
8. Add a run state and step state model.
9. Build one end-to-end governed reference workflow.
10. Add CI checks for doctrine pinning, typecheck, tests, and generated-file drift.

## First Reference Workflow

Use the closed-loop editorial system as the first governed reference workflow:

```text
Campaign brief
→ company and brand context retrieval
→ plan generation
→ human plan approval
→ asset generation
→ brand and quality evaluation
→ human publish approval
→ distribution
→ performance ingestion
→ next-brief recommendation
```

This workflow exercises context, memory, models, skills, tools, approvals, evaluation, observability, and learning while building on code already present in the repository.

## Non-Goals

- creating empty packages to make the tree look complete
- replacing working local-first behavior before an adapter exists
- tightly coupling the runtime to one model provider
- treating MCP as the entire orchestration system
- enabling broad autonomy before policy, audit, and evaluation exist
- embedding client-specific business logic in core packages
