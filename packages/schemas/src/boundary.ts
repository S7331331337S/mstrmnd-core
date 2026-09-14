import type { RuntimeScope } from "./scope";
import type { ConsequentialAction } from "./policy";

/** Filesystem mount + optional path prefix (empty prefix = entire mount). */
export interface FilesystemScopeEntry {
  mountId: string;
  pathPrefix: string;
}

/**
 * Mandatory threat / containment boundary for a workflow or run.
 *
 * Empty allow-lists are deny-all (network, credentials, MCP). Tools and
 * filesystem must be named explicitly. Missing boundary = do not run.
 */
export interface ThreatBoundary {
  id: string;
  /** Workflow or policy-pack id this boundary governs */
  workflowId: string;
  /** Hosts/CIDRs/URLs the run may reach. Empty = deny-all egress. */
  networkAllowlist: string[];
  /** Credential ids the run may use. Empty = none. */
  credentialAllowlist: string[];
  /** Tool ids the run may invoke. */
  toolsAllowlist: string[];
  /** Mounts/path prefixes the run may read or write. */
  filesystemScope: FilesystemScopeEntry[];
  /** Hard spend cap in USD for the run (inclusive). */
  costCeilingUsd: number;
  /** Consequential actions that always require a human approval step. */
  consequentialApprovals: ConsequentialAction[];
  /**
   * MCP server ids this run may talk to. Empty = no MCP (blocks shadow MCP).
   * Local in-process MSTRMND tools are not MCP servers.
   */
  mcpAllowlist: string[];
  scope?: RuntimeScope;
  reason?: string;
}

/** Proposed action checked against a ThreatBoundary. */
export interface BoundaryAction {
  toolId: string;
  networkDestinations?: string[];
  credentialIds?: string[];
  filesystem?: { mountId: string; path: string };
  estimatedCostUsd?: number;
  accruedCostUsd?: number;
  mcpServerId?: string;
  consequential?: ConsequentialAction;
}

export type BoundaryViolationCode =
  | "missing-boundary"
  | "tool-not-allowed"
  | "network-denied"
  | "credential-denied"
  | "filesystem-denied"
  | "cost-ceiling"
  | "mcp-denied"
  | "approval-required";
