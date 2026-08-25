import type {
  AgentDelegationPort,
  AgentDelegationRequest,
  AgentDelegationResult,
} from "@mstrmnd/schemas";

/**
 * Linux Foundation A2A adapter. Edge-only: domain agents, tools, and
 * orchestrator must not import this module. Wire it when Operator Zero
 * needs independently deployed agents to delegate work, and never widen
 * the inherited threat boundary.
 */
export class A2AAdapter implements AgentDelegationPort {
  async delegate(request: AgentDelegationRequest): Promise<AgentDelegationResult> {
    if (!request.boundaryId) {
      return {
        status: "rejected",
        protocol: "a2a",
        reason: "A2A delegation refused — inherited threat boundary is required",
      };
    }
    return {
      status: "unsupported",
      protocol: "a2a",
      reason:
        "A2A adapter is registered as an edge protocol. Core still prefers a single governed agent with tools; enable production A2A mapping only when independently deployed agents must delegate.",
    };
  }
}

export function createA2AAdapter(): AgentDelegationPort {
  return new A2AAdapter();
}
