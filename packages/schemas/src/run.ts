import type { RuntimeScope } from "./scope";
import type { Provenance } from "./provenance";

export type RunStatus =
  | "pending"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentStepType = "model" | "tool" | "subagent" | "approval";

export interface AgentSpec {
  id: string;
  role: string;
  description?: string;
  /** Tool ids this agent may invoke */
  toolsAllowlist: string[];
  /** Provider-agnostic model hint (capability tier, not vendor) */
  modelHint?: string;
  /** Agent ids this parent may spawn */
  subAgentsAllowlist?: string[];
}

export interface AgentStep {
  id: string;
  type: AgentStepType;
  at: string;
  summary: string;
  toolId?: string;
  agentId?: string;
  inputSummary?: string;
  outputSummary?: string;
  status: "ok" | "error" | "pending";
}

export interface SubAgentHandoff {
  parentRunId: string;
  childAgentId: string;
  goal: string;
  allowedTools: string[];
  result?: unknown;
}

export interface RunState {
  runId: string;
  status: RunStatus;
  scope: RuntimeScope;
  doctrineRef: string | null;
  parentAgentId: string;
  goal: string;
  steps: AgentStep[];
  createdAt: string;
  updatedAt: string;
  error?: string;
  resultSummary?: string;
  provenance: Provenance;
  handoffs?: SubAgentHandoff[];
  /** ThreatBoundary.id attached at createRun. */
  boundaryId?: string;
  /** Accrued model/tool spend for this run (USD). */
  costAccruedUsd?: number;
}
