import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import {
  MemoryEngine,
  VectorEngine,
  resolveVaultPath,
  resolveEmbeddingProvider,
  loadIdentity,
  EMPTY_IDENTITY,
} from "@mstrmnd/intelligence-core";
import type { IdentityModel, MemoryNode } from "@mstrmnd/schemas";

let engine = new MemoryEngine();
let identity: IdentityModel = { ...EMPTY_IDENTITY };

async function boot(): Promise<void> {
  const vaultPath = resolveVaultPath();
  const provider = await resolveEmbeddingProvider();
  engine = new MemoryEngine(new VectorEngine(provider));
  try {
    const nodes = await engine.loadVault(vaultPath);
    identity = await loadIdentity(vaultPath);
    console.error(`MSTRMND MCP: loaded ${nodes.length} notes from ${vaultPath}`);
    console.error(
      `MSTRMND MCP: embeddings via ${provider.name} (${provider.dimensions}d)`
    );
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
      "Search personal memory from your Obsidian vault. Returns matching notes " +
      "with title, id, tags, relevance score, and a content snippet. Use " +
      "'hybrid' when the user's wording may not match their notes' wording, " +
      "'keyword' when they name an exact term, tag, or filename.",
    inputSchema: {
      query: z.string().describe("Search query — matches titles, tags, and note body"),
      mode: z
        .enum(["keyword", "semantic", "hybrid"])
        .optional()
        .describe(
          "keyword = exact token matching; semantic = embedding similarity; " +
            "hybrid = both, blended (default)"
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results to return (default 10)"),
    },
  },
  async ({ query, mode = "hybrid", limit = 10 }) => {
    const scored = await engine.searchBy(query, mode, limit);
    const results = scored.map(({ node, score }) => ({
      id: node.id,
      title: node.title,
      tags: node.relationships,
      score: Number(score.toFixed(4)),
      snippet: snippet(node),
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { query, mode, count: results.length, results },
            null,
            2
          ),
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
