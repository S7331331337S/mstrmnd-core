import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  MemoryEngine,
  resolveVaultPath,
  loadIdentity,
  EMPTY_IDENTITY,
  WorkspaceManager,
} from "@mstrmnd/intelligence-core";
import type { IdentityModel, MemoryNode } from "@mstrmnd/schemas";
import { verifySeal, computeSeal } from "@mstrmnd/context-generator";
import { writeFileSync } from "fs";

const engine = new MemoryEngine();
let identity: IdentityModel = { ...EMPTY_IDENTITY };
let workspace: WorkspaceManager | null = null;

async function boot(): Promise<void> {
  const vaultPath = resolveVaultPath();
  workspace = new WorkspaceManager(WorkspaceManager.defaultConfig(vaultPath));
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
    console.error(`MSTRMND MCP: workspace policy active (root: ${vaultPath})`);
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

// ── Locked context tools ─────────────────────────────────────────────────────

const CONTEXT_TRACKED_FILES = [
  "identity.md",
  "config.json",
  "agents/roles.json",
  "connectors/filesystem.config.json",
];

server.registerTool(
  "get_locked_config",
  {
    description:
      "Read the locked MSTRMND configuration (config.json) from the context directory.",
    inputSchema: {
      contextPath: z
        .string()
        .optional()
        .describe(
          "Path to the mstrmnd-context directory (default: MSTRMND_CONTEXT_PATH env var or ./mstrmnd-context)"
        ),
    },
  },
  async ({ contextPath }) => {
    const ctxPath =
      contextPath ?? process.env["MSTRMND_CONTEXT_PATH"] ?? "./mstrmnd-context";
    const configFile = join(ctxPath, "config.json");
    if (!existsSync(configFile)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "config.json not found", contextPath: ctxPath }),
          },
        ],
        isError: true,
      };
    }
    try {
      const config = JSON.parse(readFileSync(configFile, "utf-8"));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "failed to parse config.json", detail: String(err) }),
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "verify_context_integrity",
  {
    description:
      "Verify the integrity of the MSTRMND locked context directory by checking the .mstrmnd-seal checksum.",
    inputSchema: {
      contextPath: z
        .string()
        .optional()
        .describe(
          "Path to the mstrmnd-context directory (default: MSTRMND_CONTEXT_PATH env var or ./mstrmnd-context)"
        ),
    },
  },
  async ({ contextPath }) => {
    const ctxPath =
      contextPath ?? process.env["MSTRMND_CONTEXT_PATH"] ?? "./mstrmnd-context";
    const valid = verifySeal(ctxPath, CONTEXT_TRACKED_FILES);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ contextPath: ctxPath, integrityValid: valid }),
        },
      ],
    };
  }
);


// ── Workspace write tools ────────────────────────────────────────────────────

server.registerTool(
  "list_notes",
  {
    description:
      "List all notes in the vault memory index. Optionally filter by tag. Returns id, title, and tags for each note.",
    inputSchema: {
      tag: z
        .string()
        .optional()
        .describe("Filter notes to only those with this tag (case-insensitive)."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Maximum number of notes to return (default 50)."),
    },
  },
  async ({ tag, limit = 50 }) => {
    let notes = engine.all();
    if (tag) {
      const t = tag.toLowerCase();
      notes = notes.filter((n) =>
        n.relationships.some((r) => r.toLowerCase() === t)
      );
    }
    const results = notes.slice(0, limit).map((n) => ({
      id: n.id,
      title: n.title,
      tags: n.relationships,
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { total: notes.length, returned: results.length, notes: results },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "write_note",
  {
    description:
      "Write or overwrite a note in the vault. The path must be relative to the vault root and use an allowed extension (.md or .txt). Writes are governed by the workspace policy — paths outside the vault root are blocked unless force is true (representing explicit operator approval).",
    inputSchema: {
      path: z
        .string()
        .describe(
          "Relative path within the vault (e.g. 20-Areas/daily-brief.md). Must end in .md or .txt."
        ),
      content: z.string().describe("Full file content to write."),
      force: z
        .boolean()
        .optional()
        .describe(
          "Set true to bypass the workspace policy gate (requires explicit operator approval). Defaults to false."
        ),
      reloadMemory: z
        .boolean()
        .optional()
        .describe(
          "If true, reload the in-memory vault index after writing so the new note is immediately searchable. Defaults to true."
        ),
    },
  },
  async ({ path: notePath, content, force = false, reloadMemory = true }) => {
    if (!workspace) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "Workspace not initialised. Server may still be booting." }),
          },
        ],
        isError: true,
      };
    }

    const result = await workspace.write(notePath, content, { force });

    if (!result.written) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              written: false,
              path: result.path,
              policyViolation: result.policyViolation,
            }),
          },
        ],
        isError: true,
      };
    }

    if (reloadMemory) {
      try {
        const vaultPath = resolveVaultPath();
        await engine.loadVault(vaultPath);
      } catch {
        // Non-fatal — write succeeded; index reload failed.
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ written: true, path: result.path }),
        },
      ],
    };
  }
);

const CONTEXT_MUTABLE_KEYS = ["organization", "vault", "model", "agents", "integrations"] as const;
type ContextMutableKey = typeof CONTEXT_MUTABLE_KEYS[number];

server.registerTool(
  "update_context",
  {
    description:
      "Merge a partial update into config.json inside the locked context directory, then re-seal the context. Only top-level keys (organization, vault, model, agents, integrations) may be updated. The seal is recomputed and written to .mstrmnd-seal after every successful update.",
    inputSchema: {
      contextPath: z
        .string()
        .optional()
        .describe(
          "Path to the mstrmnd-context directory (default: MSTRMND_CONTEXT_PATH env var or ./mstrmnd-context)"
        ),
      patch: z
        .record(z.string(), z.unknown())
        .describe(
          "A partial config object. Only keys in [organization, vault, model, agents, integrations] are applied."
        ),
    },
  },
  async ({ contextPath, patch }) => {
    const ctxPath =
      contextPath ?? process.env["MSTRMND_CONTEXT_PATH"] ?? "./mstrmnd-context";
    const configFile = join(ctxPath, "config.json");

    if (!existsSync(configFile)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "config.json not found", contextPath: ctxPath }),
          },
        ],
        isError: true,
      };
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(readFileSync(configFile, "utf-8")) as Record<string, unknown>;
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "failed to parse config.json", detail: String(err) }),
          },
        ],
        isError: true,
      };
    }

    const applied: string[] = [];
    const rejected: string[] = [];

    for (const [key, value] of Object.entries(patch)) {
      if ((CONTEXT_MUTABLE_KEYS as ReadonlyArray<string>).includes(key)) {
        config[key as ContextMutableKey] =
          typeof value === "object" && value !== null && !Array.isArray(value)
            ? { ...(config[key as ContextMutableKey] as object), ...(value as object) }
            : value;
        applied.push(key);
      } else {
        rejected.push(key);
      }
    }

    config["updatedAt"] = new Date().toISOString();

    try {
      writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "failed to write config.json", detail: String(err) }),
          },
        ],
        isError: true,
      };
    }

    // Re-seal
    const newSeal = computeSeal(ctxPath, CONTEXT_TRACKED_FILES);
    try {
      writeFileSync(join(ctxPath, ".mstrmnd-seal"), newSeal, "utf-8");
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "config updated but failed to write seal",
              detail: String(err),
              applied,
              rejected,
            }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            updated: true,
            contextPath: ctxPath,
            applied,
            rejected,
            newSeal,
          }, null, 2),
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
