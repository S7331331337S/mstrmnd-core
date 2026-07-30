import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import {
  MemoryEngine,
  resolveVaultPath,
  loadIdentity,
  EMPTY_IDENTITY,
} from "@mstrmnd/intelligence-core";
import type { IdentityModel, MemoryNode } from "@mstrmnd/schemas";

const engine = new MemoryEngine();
let identity: IdentityModel = { ...EMPTY_IDENTITY };

async function boot(): Promise<void> {
  const vaultPath = resolveVaultPath();
  try {
    const nodes = await engine.loadVault(vaultPath);
    identity = await loadIdentity(vaultPath);
    console.error(`MSTRMND MCP: loaded ${nodes.length} notes from ${vaultPath}`);
    if (identity.values.length || identity.interests.length) {
      console.error("MSTRMND MCP: identity profile loaded");
    } else {
      console.error(
        "MSTRMND MCP: no identity profile found — add identity.md to your vault"
      );
    }
  } catch (err) {
    console.error(`MSTRMND MCP: WARNING could not load vault at ${vaultPath}`, err);
  }
}

function snippet(node: MemoryNode, max = 300): string {
  if (!node.content) return "";
  return node.content.length <= max
    ? node.content
    : node.content.slice(0, max) + "…";
}

const server = new McpServer({
  name: "mstrmnd",
  version: "0.1.0",
});

server.registerTool(
  "search_memory",
  {
    description:
      "Search personal memory from your Obsidian vault by keyword. Returns matching notes with title, id, tags, and a content snippet.",
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
    const { memories } = engine.search(query);
    const results = memories.slice(0, limit).map((m) => ({
      id: m.id,
      title: m.title,
      tags: m.relationships,
      snippet: snippet(m),
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
    const note = engine.get(id);
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
          text: JSON.stringify({ status: "ready", identity }, null, 2),
        },
      ],
    };
  }
);

async function main() {
  await boot();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MSTRMND MCP SERVER ONLINE (stdio)");
}

main().catch((err) => {
  console.error("MSTRMND MCP fatal:", err);
  process.exit(1);
});
