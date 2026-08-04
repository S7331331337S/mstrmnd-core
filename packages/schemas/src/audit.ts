import type { RuntimeScope } from "./scope";
import type { Provenance } from "./provenance";

/**
 * Append-only audit record for consequential runtime activity.
 */
export interface AuditEvent {
  id: string;
  /** ISO-8601 timestamp */
  at: string;
  /** Stable event kind, e.g. "tool.call", "policy.decision", "approval.requested" */
  kind: string;
  /** Human-readable summary */
  summary: string;
  scope: RuntimeScope;
  provenance?: Provenance;
  /** Actor that caused the event (user, agent, workflow, system) */
  actor: {
    type: "user" | "agent" | "workflow" | "system";
    id: string;
  };
  /** Optional structured payload (tool name, decision id, paths, etc.) */
  data?: Record<string, unknown>;
  /** Correlation with a policy decision when applicable */
  policyDecisionId?: string;
  /** Outcome classification */
  outcome?: "success" | "failure" | "denied" | "pending_approval" | "cancelled";
}
