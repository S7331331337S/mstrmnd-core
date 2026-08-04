# AI SDK 7 Package Foundation

## Decision

MSTRMND Core will use Vercel AI SDK 7 as the underlying model and agent runtime while owning the operational-intelligence layer above it.

> AI SDK executes model and tool interactions. MSTRMND supplies organizational context, doctrine, memory, skills, policies, permissions, evaluation, observability, and business alignment.

## Package direction

The existing plugin work should converge into one primary alpha package:

```text
@mstrmnd/core
```

The onboarding agent, context generator, setup CLI, connectors, schemas, and examples may remain separate workspace packages where they have clear runtime boundaries. Avoid publishing competing top-level abstractions such as both `@mstrmnd/plugin-sdk` and `@mstrmnd/core`.

## Runtime requirements

- Node.js 22 or newer
- ESM-only packages
- TypeScript declaration output
- built artifacts published from `dist`
- AI SDK 7 supplied as a peer dependency
- Zod 4 supplied as a peer dependency
- provider implementations injected through AI SDK model interfaces
- no provider API keys persisted in generated context

## Target public API

```ts
import {
  createMstrmndRuntime,
  defineSkill,
  definePolicy,
  defineConnector,
  createOrganizationContext,
} from "@mstrmnd/core";
```

The initial API should remain narrow and alpha until one production workflow has run end to end.

## Ownership boundary

AI SDK owns:

- provider-neutral model calls
- streaming
- structured output
- tool execution loops
- agent interfaces
- runtime context transport
- model telemetry primitives

MSTRMND owns:

- doctrine loading and provenance
- organization, workspace, operator, and agent identity
- memory scopes
- skill registry
- connector and tool permissions
- policy evaluation and approval gates
- model-routing policy
- workflow business state
- audit events
- cost-to-outcome telemetry
- evaluations and continuous-learning feedback

## Doctrine integration

Every runtime must be able to identify the exact doctrine version it loaded from `S7331331337S/mstrmnd.md`.

A doctrine manifest should include:

```json
{
  "repository": "S7331331337S/mstrmnd.md",
  "ref": "main",
  "commit": "<pinned-sha>",
  "requiredFiles": [],
  "hashes": {},
  "loadedAt": "<iso-date>"
}
```

Production runs should record the doctrine commit with their audit events.

## Context integrity

The current SHA-256 seal is an integrity checksum, not a security lock. It detects accidental or uncoordinated changes but cannot prove trusted authorship because the checksum can be recomputed beside the modified files.

Future trusted provenance should use either:

- an HMAC whose key is stored outside the context directory, or
- a digital signature verified against an approved public key.

The manifest should also include schema version, generator version, source doctrine, tracked paths, and creation metadata.

## Migration sequence

### Phase 1 — stabilize the current PR

1. Remove accidental placeholder artifacts.
2. Add tests for context generation and verification.
3. Rename the seal language from locked to integrity-checked where appropriate.
4. Remove realistic webhook values and high-risk sample roles from examples.
5. Add organization and workspace identifiers to generated context.

### Phase 2 — AI SDK 7 migration

1. Move the repository to Node 22 and ESM.
2. Upgrade AI SDK and provider adapters together.
3. Upgrade Zod to version 4.
4. Replace source exports with compiled `dist` exports.
5. Add declaration generation and package files allowlists.
6. Inject models rather than making direct provider factories the core contract.

### Phase 3 — governed runtime

1. Add runtime context resolution.
2. Add skill and connector registries.
3. Add permissions and approval policies.
4. Add execution events and audit storage.
5. Add model budgets and outcome telemetry.
6. Add evaluation hooks.

### Phase 4 — first reference workflow

Use the closed-loop editorial system as the first complete proof:

```text
Doctrine → Brief → Research → Generation → Brand Evaluation → Approval → Publish → Performance → Learning
```

## Release policy

Begin with private prereleases:

```text
@mstrmnd/core@0.1.0-alpha.1
```

Do not publish a stable version until:

- the public contracts have tests,
- doctrine provenance is recorded,
- one governed workflow runs end to end,
- package output is consumable without TypeScript source access,
- breaking-change policy is documented.
