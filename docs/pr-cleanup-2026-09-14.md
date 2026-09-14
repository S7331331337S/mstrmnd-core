# PR cleanup — 2026-09-14

Reviewed against main `acc25d9bcb3a7284f411b471dc7a6c2c00400f83`.

## Integrated

- #33: Node 24 typecheck job for the independent mstrmnd-os workspace.
- #34: mandatory ThreatBoundary and checks on orchestrator tool dispatch.
- #36: spawn_subagent aliases and a sole registered allowlisted default.
- Prerequisite richer parent planning from commit 79113a4; workspace writes were already on main through #31 and were not imported twice.
- Preserve cockpit writeback schema exports while resolving the schema index conflict.
- Reject dot-segment filesystem boundary escapes, non-finite ceilings and invalid cost accounting. Sub-agent dispatch requires an allow decision.

## Closed without merging; source branches retained

These PRs contain unique deferred work. Closing them does not mean all their features shipped. No source branches are deleted by this cleanup.

| PR | Source commit | Disposition |
| --- | --- | --- |
| #3 | 750acd350fb3935d1b5987022fe495252f9535c6 | Plugin/onboarding proposal is incompatible with the current workspace approval contract. WorkspaceManager writes immediately in its safe zone, accepts force to bypass policy, and has unscoped reads. Preserve SDK/context-generation work for a focused follow-up using WorkspaceService and the human approval path. |
| #16 | 56cb90ea7c5215beb0fcddc1948dca3c20d8e2dd | ThreatBoundary is superseded by #34. Governance audit, skill adapter, SCM/A2A connectors, and benchmark scaffolds are unique and deferred. Do not import its older orchestrator over the integrated planning and write-approval runtime. |
| #47 | 249a9a5805859cc34702c5b2b58852964ded8b3f | Mobile prototype mixes apps/mobile with Hermes, memory/vector, workspace dependency, and deferred editorial changes. Its API route directly uses an AI Gateway model or mock rather than the governed Hermes runtime and lacks request authentication. Preserve the app for an isolated import with an authenticated host transport and independent lockfile/CI. |

## Remaining work

- [ ] Recover plugin SDK/onboarding using current scoped workspace and approval APIs.
- [ ] Evaluate unique governance/skill/SCM modules from #16 in focused PRs.
- [ ] Recover apps/mobile alone; authenticate and bound model access, then verify typecheck and web export with current main present.
- [ ] Add provider-level network and actual model-cost enforcement. Current ThreatBoundary evaluates declared tool actions; costAccruedUsd is initialized but is not provider billing metering.

PR cleanup does not alter branch protection or remove historical branches.
