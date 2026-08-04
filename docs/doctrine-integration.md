# Doctrine Integration Contract

## Purpose

Define how `mstrmnd-core` references and consumes the canonical doctrine in [`mstrmnd.md`](https://github.com/S7331331337S/mstrmnd.md).

The integration must be explicit, versioned, reviewable, and reproducible. Runtime behavior must never depend on an unpinned remote branch at execution time.

## Required Configuration

```env
MSTRMND_DOCTRINE_REPOSITORY=S7331331337S/mstrmnd.md
MSTRMND_DOCTRINE_REF=<reviewed-commit-sha-or-release-tag>
```

A future sync command should resolve those values and generate a local manifest.

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
