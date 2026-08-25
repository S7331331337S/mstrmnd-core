import type {
  GovernedObjective,
  HarnessBenchmarkReport,
  HarnessOutcomeRecord,
} from "@mstrmnd/schemas";
import { operatorZeroBoundary } from "./policy-boundary";

/** Operator Zero persistent-engineering objective used for harness benchmarks. */
export const CI_GREEN_OBJECTIVE_ID = "operator-zero-ci-green";

export function ciGreenObjective(): GovernedObjective {
  return {
    id: CI_GREEN_OBJECTIVE_ID,
    goal: "Keep CI green and resolve dependency failures",
    boundary: operatorZeroBoundary({
      toolsAllowlist: [
        "search_memory",
        "list_workspace",
        "read_file",
        "get_context",
        "spawn_subagent",
      ],
      filesystemScope: [{ mountId: "repo", pathPrefix: "" }],
      mcpAllowlist: ["mstrmnd"],
      workflowId: "operator-zero-engineering",
    }),
    successCriteria: [
      "typecheck / verify succeeds",
      "dependency failures resolved without widening the threat boundary",
      "policy decisions, cost, and interventions recorded above the harness",
    ],
  };
}

export function scoreHarnessBenchmark(
  objective: GovernedObjective,
  records: HarnessOutcomeRecord[]
): HarnessBenchmarkReport {
  const scoped = records.filter((r) => r.objectiveId === objective.id);
  const attempts = scoped.length || 1;
  const successes = scoped.filter((r) => r.status === "succeeded").length;
  const interventions = scoped.reduce((n, r) => n + r.interventionCount, 0);
  return {
    objectiveId: objective.id,
    records: scoped,
    successRate: successes / attempts,
    interventionRate: interventions / attempts,
    totalCostUsd: scoped.reduce((n, r) => n + r.costUsd, 0),
    totalPolicyEvents: scoped.reduce((n, r) => n + r.policyEventCount, 0),
  };
}

/**
 * Offline fixture transcripts. Live Cursor/Codex/Claude Code runs should
 * replace these; MSTRMND still owns the scoreboard above the harness.
 */
export function fixtureHarnessRecords(): HarnessOutcomeRecord[] {
  const objectiveId = CI_GREEN_OBJECTIVE_ID;
  return [
    {
      harness: "cursor",
      objectiveId,
      status: "intervened",
      costUsd: 0,
      interventionCount: 1,
      policyEventCount: 2,
      maintainabilityNotes: [
        "Subscriptions /goal can pursue CI, but Origin must not become the SCM source of truth",
      ],
      evidence: ["fixture: cursor cloud agent would repair CI behind GitHub"],
    },
    {
      harness: "codex",
      objectiveId,
      status: "failed",
      costUsd: 0,
      interventionCount: 2,
      policyEventCount: 1,
      maintainabilityNotes: ["No MSTRMND policy stream unless wrapped by the runtime"],
      evidence: ["fixture: execution-only, no company context"],
    },
    {
      harness: "claude-code",
      objectiveId,
      status: "intervened",
      costUsd: 0,
      interventionCount: 1,
      policyEventCount: 2,
      maintainabilityNotes: ["Skills API is a compile target, not a MSTRMND skill runtime fork"],
      evidence: ["fixture: computer use / skills as execution primitives"],
    },
  ];
}
