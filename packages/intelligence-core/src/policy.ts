import { randomUUID } from "node:crypto";
import type { PolicyDecision, PolicyOutcome, RuntimeScope } from "@mstrmnd/schemas";
import { CONSEQUENTIAL_ACTIONS } from "@mstrmnd/schemas";
import { nowIso } from "./operator-scope";

export const TOOL_DRAFT_WRITE = "draft_write";
export const TOOL_PUBLISH_DRAFTS = "publish_drafts";

const WRITE_LIKE = /write|delete|publish|stage|send/i;

function decision(
  scope: RuntimeScope,
  action: string,
  outcome: PolicyOutcome,
  reason: string
): PolicyDecision {
  return {
    id: randomUUID(),
    at: nowIso(),
    outcome,
    action,
    scope,
    reason,
  };
}

/**
 * Policy for Operator Zero tools.
 *
 * There is no environment-variable bypass. Vault writes are denied.
 * Drafts are allowed; publishing drafts to staging requires a human.
 */
export function evaluateToolPolicy(
  toolId: string,
  scope: RuntimeScope
): PolicyDecision {
  const id = toolId.trim();

  if (id === TOOL_DRAFT_WRITE) {
    return decision(
      scope,
      id,
      "allow",
      "draft_write targets the drafts mount only; vault stays read-only"
    );
  }

  if (id === TOOL_PUBLISH_DRAFTS) {
    return decision(
      scope,
      id,
      "require-approval",
      "publish_drafts copies drafts to staging and requires a human"
    );
  }

  if (WRITE_LIKE.test(id)) {
    return decision(
      scope,
      id,
      "deny",
      "direct write/delete/publish is denied; use draft_write then human-approved publish_drafts"
    );
  }

  const consequential = (CONSEQUENTIAL_ACTIONS as readonly string[]).some((a) =>
    id.includes(a.split(".").pop() ?? a)
  );
  if (consequential) {
    return decision(
      scope,
      id,
      "require-approval",
      "consequential action requires approval"
    );
  }

  return decision(
    scope,
    id,
    "allow",
    "read/search tools are allowed for Operator Zero"
  );
}
