import type { RuntimeScope } from "./scope";

export type PolicyOutcome = "allow" | "deny" | "modify" | "require-approval";

/**
 * Result of evaluating whether an action may proceed.
 */
export interface PolicyDecision {
  id: string;
  /** ISO-8601 timestamp */
  at: string;
  outcome: PolicyOutcome;
  /** Stable action id, e.g. "editorial.publish", "memory.delete" */
  action: string;
  scope: RuntimeScope;
  /** Why this decision was reached */
  reason: string;
  /** Policy / rule ids that contributed */
  ruleIds?: string[];
  /** When outcome is modify, the rewritten action payload */
  modifiedInput?: Record<string, unknown>;
  /** When outcome is require-approval, who must approve */
  approval?: {
    requiredRole?: string;
    expiresAt?: string;
    channel?: string;
  };
  /** Input snapshot used for the decision (redact secrets at the edge) */
  input?: Record<string, unknown>;
}

/** Actions that usually require approval unless an org authorizes an exception. */
export const CONSEQUENTIAL_ACTIONS = [
  "external.communicate",
  "content.publish",
  "money.commit",
  "data.delete",
  "permission.change",
  "production.code.change",
  "contract.enter",
  "sensitive.disclose",
] as const;

export type ConsequentialAction = (typeof CONSEQUENTIAL_ACTIONS)[number];
