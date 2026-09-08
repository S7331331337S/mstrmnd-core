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

/** Set when a run produced drafts and is blocked on a human. */
export interface RunPendingApproval {
  policyDecisionId: string;
  action: string;
  draftPaths: string[];
}

export interface RunApproval {
  outcome: "approved" | "rejected";
  actorId: string;
  at: string;
  policyDecisionId?: string;
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
  pendingApproval?: RunPendingApproval;
  approval?: RunApproval;
  /** Staging-relative paths written on approve (never the vault). */
  publishedPaths?: string[];
}
