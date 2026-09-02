# CI Repair Orchestrator

`Codex CI Repair` is a bounded repair loop layered on top of the existing `CI`
workflow. It does not replace deterministic tests, merge changes, or promote a
deployment.

## Flow

1. `CI` fails on a same-repository branch owned by the repository owner or the
   trusted GitHub Actions bot.
2. A read-only job checks out the failed commit and counts prior repair rounds.
3. Dependencies are installed before Codex receives the API credential.
4. `openai/codex-action` runs with the `:workspace` permission profile and
   `drop-sudo`, reproduces the checks, makes a minimal fix, and verifies it.
5. The candidate binary patch is uploaded as a short-lived artifact.
6. A separate job with repository write permission rejects protected-file edits,
   applies the patch, and opens or updates a repair PR.
7. The repair commit triggers `CI` again. Failure starts the next round; success
   stops the loop. Three failed rounds stop for human diagnosis.

Production promotion and merging always remain human-controlled.

## One-time repository setup

1. Add an Actions secret named `OPENAI_API_KEY` under **Settings → Secrets and
   variables → Actions**. Use a scoped project key and set an appropriate spend
   limit.
2. Under **Settings → Actions → General → Workflow permissions**, allow GitHub
   Actions to create pull requests. The workflow still assigns write permission
   only to the isolated publication job.
3. Keep the normal `CI` checks required in branch protection. Do not make the
   repair workflow a replacement for them.

## Guardrails

- Maximum three repair rounds per repair branch.
- Only same-repository failures started by the owner or `github-actions[bot]`.
- Codex never receives a repository write token.
- The patch publisher never receives the OpenAI API key.
- Changes to workflows, Actions, `AGENTS.md`, `doctrine.pin.json`, or
  `CODEOWNERS` are rejected.
- Tests may be fixed when wrong, but cannot be skipped, weakened, quarantined,
  or have assertions removed merely to make CI green.
- Credential, infrastructure, migration, or product-intent failures stop for a
  human decision.

## Operating it

- The repair PR is the audit surface. Review its diff and CI checks normally.
- To stop a loop early, close the repair PR and delete its `codex/ci-repair-*`
  branch, or disable the workflow.
- If the third round fails, inspect the latest `CI` and `Codex CI Repair` logs;
  the workflow intentionally creates no fourth attempt.

