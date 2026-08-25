import type { RuntimeScope } from "./scope";
import type { ThreatBoundary } from "./boundary";

/**
 * Agent Governance Audit inventory graph:
 * identity → model/harness → MCP/tool → credential → data scope →
 * allowed actions → approvals → audit trail
 *
 * Plus agent containment / MCP exposure as a first-class section.
 */
export interface GovernanceNode {
  id: string;
  kind:
    | "human"
    | "agent"
    | "harness"
    | "model"
    | "mcp"
    | "tool"
    | "credential"
    | "data-scope"
    | "action"
    | "approval"
    | "audit";
  label: string;
  detail?: Record<string, unknown>;
}

export interface GovernanceEdge {
  from: string;
  to: string;
  relation: string;
}

export interface McpExposure {
  serverId: string;
  allowed: boolean;
  reason: string;
}

export interface ContainmentReport {
  boundaryId: string | null;
  networkDefault: "deny-all" | "allowlist";
  mcpDefault: "deny-all" | "allowlist";
  shadowMcpRisk: "low" | "medium" | "high";
  mcpExposures: McpExposure[];
  notes: string[];
}

export interface GovernanceInventory {
  generatedAt: string;
  scope: RuntimeScope;
  boundary: ThreatBoundary | null;
  nodes: GovernanceNode[];
  edges: GovernanceEdge[];
  containment: ContainmentReport;
}
