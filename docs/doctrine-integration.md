# Doctrine Integration Contract

> Shared agent brief and backlog: [`MASTER.md`](./MASTER.md).

## Purpose

Define how `mstrmnd-core` references and consumes the canonical doctrine in [`mstrmnd.md`](https://github.com/S7331331337S/mstrmnd.md).

The integration must be explicit, versioned, reviewable, and reproducible. Runtime behavior must never depend on an unpinned remote branch at execution time.

## Required Configuration

Committed pin (source of truth):

```text
doctrine.pin.json
```

Optional local/CI env overrides (see `.env.doctrine.example`):

```env
MSTRMND_DOCTRINE_REPOSITORY=S7331331337S/mstrmnd.md
MSTRMND_DOCTRINE_REF=<reviewed-40-char-commit-sha>
MSTRMND_DOCTRINE_TOKEN=<optional private-repo token>
```

### Sync commands

```bash
# From a local checkout of mstrmnd.md (Operator Zero / offline)
pnpm doctrine:sync -- --from-dir /path/to/mstrmnd.md --update-pin

# From GitHub using the pinned SHA in doctrine.pin.json
pnpm doctrine:sync

# Validate pin policy (+ manifest when status=active)
pnpm doctrine:validate

# CI self-test against fixtures/doctrine-min
pnpm doctrine:ci
```

Sync writes allowlisted Markdown into `.generated/mstrmnd-md/` and `manifest.json`.
Floating refs (`main` / `master`) are rejected.

## Manifest Shape

```json
{
  "schemaVersion": "1.0.0",
  "repository": "S7331331337S/mstrmnd.md",
  "ref": "<commit-sha>",
  "syncedAt": "<iso-timestamp>",
  "files": [
    {
      "sourcePath": "company/canon.md",
      "localPath": ".generated/mstrmnd-md/company/canon.md",
      "sha256": "<checksum>"
    }
  ]
}
```

## Minimum Doctrine Set

A production runtime should fail validation when any required file is unavailable:

- `README.md`
- `company/philosophy.md`
- `company/canon.md`
- `strategy/positioning.md`
- `platform/intelligence-architecture.md`
- `platform/security-governance.md`
- `platform/evaluation-observability.md`
- `agents/agent-specification.md`
- `skills/skill-standard.md`
- `connectors/connector-standard.md`
- `design/brand-system.md`
- `research/research-standard.md`
- `roadmap/company-operating-system.md`

Commercial documents may be loaded only into systems and agents authorized to use pricing, sales, or proposal context.

## Security Rules

- Never fetch mutable doctrine during an active workflow.
- Never execute code from the doctrine repository.
- Treat Markdown as untrusted input until parsed and validated.
- Restrict which source paths may be synced.
- Verify checksums after synchronization.
- Record the doctrine ref on every agent run and generated artifact where doctrine influenced the result.
- Do not expose confidential commercial or company context to agents without a defined need and authorization.

## Update Procedure

1. Merge doctrine changes in `mstrmnd.md`.
2. Review the merged commit or release.
3. Update `MSTRMND_DOCTRINE_REF` in a dedicated `mstrmnd-core` PR.
4. Regenerate doctrine files and manifest.
5. Run policy, behavior, brand, and regression evaluations.
6. Merge only after changed runtime behavior is understood.

## Future Automation

A GitHub Action may open a PR when `mstrmnd.md` publishes a new release. It should not merge automatically. The PR should contain:

- old and new doctrine refs
- changed doctrine paths
- generated manifest diff
- affected evaluation suites
- summary of likely runtime impact

## Design Principle

The pointer creates alignment without coupling release velocity. `mstrmnd.md` can evolve as the company constitution, while `mstrmnd-core` deliberately adopts reviewed versions as executable policy and context.
