import type { AgentDelegationPort, AgentDelegationRequest, AgentDelegationResult } from "@mstrmnd/schemas";

/**
 * Local no-op delegation port. Operator Zero still prefers one well-governed
 * agent with tools over a multi-agent mesh.
 */
export const localDelegationPort: AgentDelegationPort = {
  async delegate(request: AgentDelegationRequest): Promise<AgentDelegationResult> {
    return {
      status: "unsupported",
      protocol: "none",
      reason: `A2A is an edge adapter, not a Core dependency. Request from ${request.fromAgentId} for "${request.goal}" stays local until MSTRMND_A2A=a2a is wired.`,
    };
  },
};
