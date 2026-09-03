import { randomUUID } from "node:crypto";
import type {
  BoundaryAction,
  ConsequentialAction,
  PolicyDecision,
  PolicyOutcome,
  ThreatBoundary,
} from "@mstrmnd/schemas";
import { CONSEQUENTIAL_ACTIONS } from "@mstrmnd/schemas";
import { nowIso } from "./operator-scope";

export class MissingBoundaryError extends Error {
  constructor(message = "threat boundary is mandatory; refusing to run") {
    super(message);
    this.name = "MissingBoundaryError";
  }
}

export class BoundaryViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoundaryViolationError";
  }
}

const REQUIRED_ARRAYS: Array<keyof ThreatBoundary> = [
  "networkAllowlist",
  "credentialAllowlist",
  "toolsAllowlist",
  "filesystemScope",
  "consequentialApprovals",
  "mcpAllowlist",
];

/** Fail closed if a boundary is missing or structurally incomplete. */
export function assertBoundary(
  boundary: ThreatBoundary | null | undefined
): asserts boundary is ThreatBoundary {
  if (!boundary || typeof boundary !== "object") {
    throw new MissingBoundaryError();
  }
  if (!boundary.id?.trim() || !boundary.workflowId?.trim()) {
    throw new MissingBoundaryError(
      "threat boundary id and workflowId are required"
    );
  }
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(boundary[key])) {
      throw new MissingBoundaryError(`threat boundary missing ${key}`);
    }
  }
  if (
    typeof boundary.costCeilingUsd !== "number" ||
    boundary.costCeilingUsd < 0
  ) {
    throw new MissingBoundaryError(
      "threat boundary costCeilingUsd must be >= 0"
    );
  }
}

export function operatorZeroBoundary(opts: {
  toolsAllowlist: string[];
  filesystemScope: ThreatBoundary["filesystemScope"];
  mcpAllowlist?: string[];
  workflowId?: string;
}): ThreatBoundary {
  return {
    id: "operator-zero-default",
    workflowId: opts.workflowId ?? "operator-zero",
    networkAllowlist: [],
    credentialAllowlist: [],
    toolsAllowlist: [...opts.toolsAllowlist],
    filesystemScope: opts.filesystemScope.map((e) => ({
      mountId: e.mountId,
      pathPrefix: e.pathPrefix,
    })),
    costCeilingUsd: 1,
    consequentialApprovals: [...CONSEQUENTIAL_ACTIONS],
    mcpAllowlist: opts.mcpAllowlist ?? ["mstrmnd"],
    reason:
      "Operator Zero default: deny-all egress, no extra credentials, local MCP only, approval on consequential actions",
  };
}

function hostAllowed(allowlist: string[], destination: string): boolean {
  const dest = destination.trim().toLowerCase();
  if (!dest) return false;
  let host = dest;
  try {
    if (dest.includes("://")) host = new URL(dest).hostname.toLowerCase();
  } catch {
    host = dest;
  }
  return allowlist.some((entry) => {
    const allowed = entry.trim().toLowerCase();
    if (!allowed) return false;
    if (host === allowed) return true;
    return host.endsWith("." + allowed);
  });
}

/**
 * Mount-relative path check, component-wise (same idea as isInsideRoot).
 * Empty pathPrefix = entire mount. Sibling prefixes must not match.
 */
function pathInScope(
  scope: ThreatBoundary["filesystemScope"],
  mountId: string,
  path: string
): boolean {
  const parts = path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
  return scope.some((entry) => {
    if (entry.mountId !== mountId) return false;
    const prefix = entry.pathPrefix
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    if (!prefix) return true;
    const prefixParts = prefix.split("/").filter(Boolean);
    if (parts.length < prefixParts.length) return false;
    return prefixParts.every((part, i) => parts[i] === part);
  });
}

function inferConsequential(toolId: string): ConsequentialAction | undefined {
  return (CONSEQUENTIAL_ACTIONS as readonly string[]).find((action) => {
    const tail = action.split(".").pop() ?? action;
    return toolId === action || toolId.includes(tail);
  }) as ConsequentialAction | undefined;
}

/**
 * Evaluate a proposed tool/action against the workflow threat boundary.
 * Empty allow-lists deny. Write-like tools without an explicit consequential
 * tag still require approval when they look like mutate/publish/send.
 */
export function evaluateBoundaryAction(
  boundary: ThreatBoundary | null | undefined,
  action: BoundaryAction
): PolicyDecision {
  try {
    assertBoundary(boundary);
  } catch (err) {
    return deny(
      action.toolId,
      err instanceof Error ? err.message : "missing boundary",
      "missing-boundary"
    );
  }
  const bound: ThreatBoundary = boundary;

  const writeLike = /write|delete|publish|stage|send|patch|merge/i.test(
    action.toolId
  );
  const consequential =
    action.consequential ?? inferConsequential(action.toolId);
  const requiresApproval =
    (consequential != null &&
      bound.consequentialApprovals.includes(consequential)) ||
    writeLike;

  if (!bound.toolsAllowlist.includes(action.toolId)) {
    return deny(
      action.toolId,
      `tool ${action.toolId} is not on the boundary allow-list`,
      "tool-not-allowed"
    );
  }

  if (action.networkDestinations?.length) {
    const blocked = action.networkDestinations.filter(
      (d) => !hostAllowed(bound.networkAllowlist, d)
    );
    if (blocked.length) {
      return deny(
        action.toolId,
        `network denied: ${blocked.join(", ")} (empty allow-list is deny-all)`,
        "network-denied"
      );
    }
  }

  if (action.credentialIds?.length) {
    const blocked = action.credentialIds.filter(
      (id) => !bound.credentialAllowlist.includes(id)
    );
    if (blocked.length) {
      return deny(
        action.toolId,
        `credential ${blocked.join(", ")} is not on the boundary allow-list`,
        "credential-denied"
      );
    }
  }

  if (action.filesystem) {
    if (
      !pathInScope(
        bound.filesystemScope,
        action.filesystem.mountId,
        action.filesystem.path
      )
    ) {
      return deny(
        action.toolId,
        `filesystem ${action.filesystem.mountId}:${action.filesystem.path} is out of scope`,
        "filesystem-denied"
      );
    }
  }

  const accrued = action.accruedCostUsd ?? 0;
  const estimated = action.estimatedCostUsd ?? 0;
  if (accrued + estimated > bound.costCeilingUsd) {
    return deny(
      action.toolId,
      `cost ceiling $${bound.costCeilingUsd} exceeded (accrued ${accrued} + estimated ${estimated})`,
      "cost-ceiling"
    );
  }

  if (action.mcpServerId && !bound.mcpAllowlist.includes(action.mcpServerId)) {
    return deny(
      action.toolId,
      `MCP server ${action.mcpServerId} is not on the boundary allow-list (shadow MCP denied)`,
      "mcp-denied"
    );
  }

  if (requiresApproval) {
    return {
      id: randomUUID(),
      at: nowIso(),
      outcome: "require-approval",
      action: action.toolId,
      scope: bound.scope ?? {
        organizationId: "mstrmnd",
        workspaceId: "operator-zero",
        userId: "local-operator",
      },
      reason: consequential
        ? `consequential action ${consequential} requires approval`
        : "write-like tool requires approval",
      ruleIds: ["threat-boundary", "approval-required"],
    };
  }

  return {
    id: randomUUID(),
    at: nowIso(),
    outcome: "allow",
    action: action.toolId,
    scope: bound.scope ?? {
      organizationId: "mstrmnd",
      workspaceId: "operator-zero",
      userId: "local-operator",
    },
    reason: "action is inside the threat boundary",
    ruleIds: ["threat-boundary"],
  };
}

function deny(
  action: string,
  reason: string,
  rule: string
): PolicyDecision {
  const outcome: PolicyOutcome = "deny";
  return {
    id: randomUUID(),
    at: nowIso(),
    outcome,
    action,
    scope: {
      organizationId: "mstrmnd",
      workspaceId: "operator-zero",
      userId: "local-operator",
    },
    reason,
    ruleIds: ["threat-boundary", rule],
  };
}
