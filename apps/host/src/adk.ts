import { listAgentSpecs } from "@mstrmnd/intelligence-core";
import { MCP_TOOL_IDS } from "@mstrmnd/mcp-server";
import type { MstrmndRuntime } from "@mstrmnd/intelligence-core";

const TOOL_DOCS: Record<string, { description: string; tags: string[] }> = {
  search_memory: {
    description: "Search scoped memory notes by keyword.",
    tags: ["memory"],
  },
  get_note: {
    description: "Read a memory note by path or title.",
    tags: ["memory"],
  },
  get_identity: {
    description: "Return the operator identity profile.",
    tags: ["context"],
  },
  get_context: {
    description: "Assemble the Operator Zero context pack.",
    tags: ["context", "doctrine"],
  },
  list_workspace: {
    description: "List files under a workspace mount.",
    tags: ["workspace"],
  },
  read_file: {
    description: "Read a mount-relative file. Path escapes are denied.",
    tags: ["workspace"],
  },
  write_file: {
    description: "Stage a draft write. Does not publish.",
    tags: ["workspace", "approval"],
  },
  approve_write: {
    description: "Publish a staged draft after human approval.",
    tags: ["workspace", "approval"],
  },
  list_agents: {
    description: "List registered parent and sub-agents.",
    tags: ["agents"],
  },
  run_agent: {
    description: "Dispatch an orchestrator run (policy-checked).",
    tags: ["agents", "orchestrator"],
  },
};

export function publicBaseUrl(reqHost?: string): string {
  const fromEnv = process.env.MSTRMND_PUBLIC_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const port = process.env.PORT ?? "8080";
  if (reqHost) return `http://${reqHost}`;
  return `http://127.0.0.1:${port}`;
}

/** A2A-style agent card so ADK / other harnesses can discover the layer. */
export function agentCard(runtime: MstrmndRuntime, baseUrl: string) {
  return {
    protocolVersion: "0.2.9",
    name: "MSTRMND",
    description:
      "Model-agnostic Operator Zero intelligence layer — context, memory, workspace, policy-gated runs.",
    url: `${baseUrl}/v1/runs`,
    provider: {
      organization: runtime.context.company.name,
      url: baseUrl,
    },
    version: "0.2.0",
    documentationUrl: `${baseUrl}/adk`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["application/json"],
    skills: MCP_TOOL_IDS.map((id) => ({
      id,
      name: id,
      description: TOOL_DOCS[id]?.description ?? id,
      tags: TOOL_DOCS[id]?.tags ?? [],
      inputModes: ["application/json"],
      outputModes: ["application/json"],
    })),
  };
}

export function adkManifest(runtime: MstrmndRuntime, baseUrl: string) {
  const pin = runtime.context.doctrineRef;
  return {
    schemaVersion: "1.0.0",
    name: "mstrmnd-adk",
    description:
      "MSTRMND agent development kit surface — transports, agents, tools, doctrine pin.",
    doctrineRef: pin,
    company: runtime.context.company.name,
    operator: runtime.context.operator.displayName,
    provider: runtime.provider.id,
    transports: {
      api: `${baseUrl}/v1`,
      mcpHttp: `${baseUrl}/mcp`,
      mcpStdio: {
        command: "pnpm",
        args: ["--filter", "@mstrmnd/mcp-server", "start"],
      },
      cli: {
        command: "pnpm",
        args: ["hermes", "--", "--dry-run"],
      },
      adk: `${baseUrl}/adk`,
      agentCard: `${baseUrl}/.well-known/agent.json`,
    },
    agents: listAgentSpecs(),
    tools: MCP_TOOL_IDS.map((id) => ({
      id,
      description: TOOL_DOCS[id]?.description ?? id,
      tags: TOOL_DOCS[id]?.tags ?? [],
    })),
    approval: {
      writes: "draft-then-approve",
      apiRuns: "deny-publish",
      approveHeader: "X-MSTRMND-APPROVE",
    },
  };
}
