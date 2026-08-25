import type {
  AgentSpec,
  ContainmentReport,
  GovernanceInventory,
  GovernanceNode,
  McpExposure,
  RuntimeScope,
  ThreatBoundary,
} from "@mstrmnd/schemas";
import { nowIso } from "./operator-scope";

export interface GovernanceAuditInput {
  scope: RuntimeScope;
  boundary: ThreatBoundary | null;
  human: { id: string; label: string };
  agent: Pick<AgentSpec, "id" | "role" | "toolsAllowlist">;
  harnessId: string;
  modelId: string;
  /** MCP servers observed or configured for this operator. */
  mcpServers: Array<{ id: string; label: string }>;
  credentials: Array<{ id: string; label: string }>;
  dataScopes: Array<{ id: string; label: string }>;
  auditTrailId?: string;
}

/**
 * Build the Agent Governance Audit inventory graph.
 * Containment / MCP exposure is a first-class section, not a footnote.
 */
export function buildGovernanceInventory(
  input: GovernanceAuditInput
): GovernanceInventory {
  const boundary = input.boundary;
  const nodes: GovernanceNode[] = [
    { id: `human:${input.human.id}`, kind: "human", label: input.human.label },
    {
      id: `agent:${input.agent.id}`,
      kind: "agent",
      label: input.agent.id,
      detail: { role: input.agent.role },
    },
    { id: `harness:${input.harnessId}`, kind: "harness", label: input.harnessId },
    { id: `model:${input.modelId}`, kind: "model", label: input.modelId },
  ];

  for (const tool of input.agent.toolsAllowlist) {
    nodes.push({ id: `tool:${tool}`, kind: "tool", label: tool });
  }
  for (const mcp of input.mcpServers) {
    nodes.push({
      id: `mcp:${mcp.id}`,
      kind: "mcp",
      label: mcp.label,
      detail: { allowed: boundary?.mcpAllowlist.includes(mcp.id) ?? false },
    });
  }
  for (const cred of input.credentials) {
    nodes.push({
      id: `credential:${cred.id}`,
      kind: "credential",
      label: cred.label,
      detail: { allowed: boundary?.credentialAllowlist.includes(cred.id) ?? false },
    });
  }
  for (const scope of input.dataScopes) {
    nodes.push({ id: `data:${scope.id}`, kind: "data-scope", label: scope.label });
  }
  for (const action of boundary?.consequentialApprovals ?? []) {
    nodes.push({ id: `action:${action}`, kind: "action", label: action });
    nodes.push({
      id: `approval:${action}`,
      kind: "approval",
      label: `approve ${action}`,
    });
  }
  nodes.push({
    id: `audit:${input.auditTrailId ?? "local"}`,
    kind: "audit",
    label: "audit trail",
  });

  const edges = [
    { from: `human:${input.human.id}`, to: `agent:${input.agent.id}`, relation: "authorizes" },
    { from: `agent:${input.agent.id}`, to: `harness:${input.harnessId}`, relation: "executes-on" },
    { from: `harness:${input.harnessId}`, to: `model:${input.modelId}`, relation: "calls" },
    ...input.agent.toolsAllowlist.map((tool) => ({
      from: `agent:${input.agent.id}`,
      to: `tool:${tool}`,
      relation: "may-invoke",
    })),
    ...input.mcpServers.map((mcp) => ({
      from: `agent:${input.agent.id}`,
      to: `mcp:${mcp.id}`,
      relation: "mcp",
    })),
    ...input.credentials.map((cred) => ({
      from: `agent:${input.agent.id}`,
      to: `credential:${cred.id}`,
      relation: "may-use",
    })),
    ...input.dataScopes.map((scope) => ({
      from: `agent:${input.agent.id}`,
      to: `data:${scope.id}`,
      relation: "reads",
    })),
    ...(boundary?.consequentialApprovals ?? []).flatMap((action) => [
      { from: `agent:${input.agent.id}`, to: `action:${action}`, relation: "proposes" },
      { from: `action:${action}`, to: `approval:${action}`, relation: "requires" },
      {
        from: `approval:${action}`,
        to: `audit:${input.auditTrailId ?? "local"}`,
        relation: "records",
      },
    ]),
  ];

  return {
    generatedAt: nowIso(),
    scope: input.scope,
    boundary,
    nodes,
    edges,
    containment: buildContainment(boundary, input.mcpServers),
  };
}

function buildContainment(
  boundary: ThreatBoundary | null,
  mcpServers: Array<{ id: string; label: string }>
): ContainmentReport {
  if (!boundary) {
    return {
      boundaryId: null,
      networkDefault: "deny-all",
      mcpDefault: "deny-all",
      shadowMcpRisk: "high",
      mcpExposures: mcpServers.map((s) => ({
        serverId: s.id,
        allowed: false,
        reason: "no threat boundary — treat every MCP server as shadow MCP",
      })),
      notes: [
        "Agent containment is missing. Refuse unattended execution until a threat boundary is attached.",
      ],
    };
  }

  const exposures: McpExposure[] = mcpServers.map((s) => {
    const allowed = boundary.mcpAllowlist.includes(s.id);
    return {
      serverId: s.id,
      allowed,
      reason: allowed
        ? "on mcpAllowlist"
        : "not on mcpAllowlist — shadow MCP, block or isolate",
    };
  });
  const unknown = exposures.filter((e) => !e.allowed).length;
  const shadowMcpRisk: ContainmentReport["shadowMcpRisk"] =
    unknown === 0 ? "low" : unknown <= 2 ? "medium" : "high";

  return {
    boundaryId: boundary.id,
    networkDefault: boundary.networkAllowlist.length ? "allowlist" : "deny-all",
    mcpDefault: boundary.mcpAllowlist.length ? "allowlist" : "deny-all",
    shadowMcpRisk,
    mcpExposures: exposures,
    notes: [
      `egress: ${boundary.networkAllowlist.length ? boundary.networkAllowlist.join(", ") : "deny-all"}`,
      `credentials: ${boundary.credentialAllowlist.length ? boundary.credentialAllowlist.join(", ") : "none"}`,
      `cost ceiling: $${boundary.costCeilingUsd}`,
      "Do not replace network MCP controls (e.g. Cloudflare Gateway). Provide the business-policy layer above them.",
    ],
  };
}
