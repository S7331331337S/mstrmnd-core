/**
 * Protocol-agnostic agent-to-agent delegation.
 *
 * A2A (Linux Foundation AAIF) is an *edge* protocol, not a Core dependency.
 * When independently deployed agents must delegate, map this contract through
 * an adapter. Do not invent a proprietary A2A replacement, and do not build
 * multi-agent topology merely because the protocol exists.
 */
export interface AgentDelegationRequest {
  fromAgentId: string;
  goal: string;
  /** Inherited threat boundary — never widen at the edge. */
  boundaryId: string;
  allowedTools: string[];
}

export interface AgentDelegationResult {
  status: "accepted" | "rejected" | "unsupported";
  reason: string;
  protocol: "none" | "a2a";
}

export interface AgentDelegationPort {
  delegate(request: AgentDelegationRequest): Promise<AgentDelegationResult>;
}
