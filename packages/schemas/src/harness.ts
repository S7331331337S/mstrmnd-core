import type { ThreatBoundary } from "./boundary";

/**
 * Execution harnesses (Cursor, Codex, Claude Code, Hermes) run work.
 * MSTRMND records policy, cost, interventions, and outcomes above them.
 */
export type ExecutionHarnessKind =
  | "cursor"
  | "codex"
  | "claude-code"
  | "hermes";

export interface GovernedObjective {
  id: string;
  goal: string;
  boundary: ThreatBoundary;
  successCriteria: string[];
}

export type HarnessOutcomeStatus =
  | "succeeded"
  | "failed"
  | "intervened"
  | "blocked-by-policy";

export interface HarnessOutcomeRecord {
  harness: ExecutionHarnessKind;
  objectiveId: string;
  status: HarnessOutcomeStatus;
  /** USD attributed to this harness attempt */
  costUsd: number;
  interventionCount: number;
  policyEventCount: number;
  maintainabilityNotes: string[];
  evidence: string[];
}

export interface HarnessBenchmarkReport {
  objectiveId: string;
  records: HarnessOutcomeRecord[];
  /** Successful outcomes / attempts */
  successRate: number;
  /** Interventions / attempts */
  interventionRate: number;
  totalCostUsd: number;
  totalPolicyEvents: number;
}
