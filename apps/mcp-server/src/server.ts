import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import {
  createRuntime,
  WorkspacePathError,
  type MstrmndRuntime,
} from "@mstrmnd/intelligence-core";
import type { MemoryNode } from "@mstrmnd/schemas";

let runtime: MstrmndRuntime;

function snippet(node: MemoryNode, max = 300): string {
  if (!node.content) return "";
  return node.content.length <= max
    ? node.content
    : node.content.slice(0, max) + "…";
}

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

async function boot(): Promise<void> {
  runtime = await createRuntime({ allowMissingVault: true });
  console.error(
    `MSTRMND MCP: runtime ready — memory=${runtime.memory.size} doctrine=${runtime.context.doctrineRef ?? "none"} company=${runtime.context.company.name} model=${runtime.provider.id}`
  );
}

const server = new McpServer({
  name: "mstrmnd",
  version: "0.2.0",
});

server.registerTool(
  "search_memory",
  {
    description:
      "Search personal memory from your Obsidian vault by keyword. Returns matching notes with title, id, tags, snippet, scope, and provenance.",
    inputSchema: {
      query: z.string().describe("Search query — matches titles, tags, and note body"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results to return (default 10)"),
    },
  },
  async ({ query, limit = 10 }) => {
    const { memories } = runtime.memory.search(query);
    const results = memories.slice(0, limit).map((m) => ({
      id: m.id,
      title: m.title,
      tags: m.relationships,
      snippet: snippet(m),
      scope: {
        organizationId: m.scope.organizationId,
        workspaceId: m.scope.workspaceId,
        userId: m.scope.userId,
      },
      provenance: {
        source: m.provenance.source,
        adapter: m.provenance.adapter,
        sourcePath: m.provenance.sourcePath,
      },
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ query, count: results.length, results }, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "get_note",
  {
    description:
      "Retrieve a full note from memory by relative path (e.g. 20-Areas/Business.md) or title.",
    inputSchema: {
      id: z.string().describe("Note relative path or title"),
    },
  },
  async ({ id }) => {
    const note = runtime.memory.get(id);
    if (!note) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "not found", id }) }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: note.id,
              title: note.title,
              tags: note.relationships,
              content: note.content ?? "",
              scope: note.scope,
              provenance: note.provenance,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "get_identity",
  {
    description:
      "Return the user's identity profile — values, interests, creative patterns, and preferences — loaded from identity.md in the vault.",
    inputSchema: {},
  },
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { status: "ready", identity: runtime.identity },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "get_context",
  {
    description:
      "Return the assembled Operator Zero ContextPack — company, operator, business, identity, doctrine ref, and memory hits.",
    inputSchema: {
      memoryQuery: z
        .string()
        .optional()
        .describe("Optional keyword query to include memory hits"),
    },
  },
  async ({ memoryQuery }) => {
    if (memoryQuery?.trim()) {
      const { assembleContext } = await import("@mstrmnd/intelligence-core");
      const pack = await assembleContext({
        vaultPath: runtime.config.vaultPath,
        repoRoot: runtime.config.repoRoot,
        memory: runtime.memory,
        memoryQuery,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ status: "ready", context: pack }, null, 2),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { status: "ready", context: runtime.context },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "list_workspace",
  {
    description:
      "List files and folders under a workspace mount (default: vault). Paths are mount-relative; escapes are denied.",
    inputSchema: {
      mountId: z
        .string()
        .optional()
        .describe("Mount id (default: vault)"),
      path: z
        .string()
        .optional()
        .describe("Mount-relative directory path (default: root)"),
    },
  },
  async ({ mountId, path }) => {
    try {
      const id =
        mountId ??
        runtime.workspace.listMounts()[0]?.id ??
        "vault";
      const nodes = await runtime.workspace.list(id, path ?? "");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                mountId: id,
                path: path ?? "",
                count: nodes.length,
                nodes: nodes.map((n) => ({
                  path: n.path,
                  kind: n.kind,
                  name: n.name,
                  size: n.size,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return toolError(err);
    }
  }
);

server.registerTool(
  "read_file",
  {
    description:
      "Read a text file from a workspace mount (size-capped). Path escapes are denied.",
    inputSchema: {
      path: z.string().describe("Mount-relative file path"),
      mountId: z.string().optional().describe("Mount id (default: vault)"),
      maxBytes: z.number().int().positive().optional(),
    },
  },
  async ({ path, mountId, maxBytes }) => {
    try {
      const id =
        mountId ??
        runtime.workspace.listMounts()[0]?.id ??
        "vault";
      const file = await runtime.workspace.read(id, path, maxBytes);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ mountId: id, ...file }, null, 2),
          },
        ],
      };
    } catch (err) {
      if (err instanceof WorkspacePathError) return toolError(err);
      return toolError(err);
    }
  }
);

server.registerTool(
  "list_agents",
  {
    description: "List registered agent specs (parent and sub-agents).",
    inputSchema: {},
  },
  async () => {
    const { listAgentSpecs } = await import("@mstrmnd/intelligence-core");
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ agents: listAgentSpecs() }, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "run_agent",
  {
    description:
      "Create and dispatch an orchestrator run (default operator-agent). Uses EchoProvider unless MSTRMND_MODEL_PROVIDER is set.",
    inputSchema: {
      goal: z.string().describe("Run goal"),
      agentId: z
        .string()
        .optional()
        .describe("Agent id (default: operator-agent)"),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true, do not persist run/audit files"),
    },
  },
  async ({ goal, agentId = "operator-agent", dryRun = false }) => {
    try {
      const orch = runtime.createOrchestrator({ dryRun });
      const run = orch.createRun(agentId, goal);
      const finished = await orch.dispatch(run);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                runId: finished.runId,
                status: finished.status,
                doctrineRef: finished.doctrineRef,
                boundaryId: finished.boundaryId,
                resultSummary: finished.resultSummary,
                steps: finished.steps.length,
                error: finished.error,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return toolError(err);
    }
  }
);

async function main() {
  await boot();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MSTRMND MCP SERVER ONLINE (stdio) — plugin runtime");
}

main().catch((err) => {
  console.error("MSTRMND MCP fatal:", err);
  process.exit(1);
});
