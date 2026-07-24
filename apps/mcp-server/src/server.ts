import { MemoryEngine } from "@mstrmnd/intelligence-core";
import type { IdentityModel, MemoryNode } from "@mstrmnd/schemas";

function resolveVaultPath(): string {
  const fromEnv = process.env.OBSIDIAN_VAULT_PATH;
  if (fromEnv) return fromEnv;
  return `${process.env.HOME}/Documents/Obsidian Vault`;
}

const IDENTITY: IdentityModel = {
  values: [],
  interests: [],
  creativePatterns: [],
  preferences: [],
};

const engine = new MemoryEngine();

/** Resolves once the vault is loaded (or fails gracefully). Tools await this
 *  so they never read an uninitialized graph. */
const ready = boot();

async function boot(): Promise<void> {
  const vaultPath = resolveVaultPath();
  try {
    const nodes = await engine.loadVault(vaultPath);
    console.log(`MCP memory substrate: loaded ${nodes.length} notes`);
  } catch {
    console.log(`MCP memory substrate: WARNING could not load vault at ${vaultPath}`);
  }
}

export const tools = {
  async get_identity(): Promise<{ status: string; identity: IdentityModel }> {
    await ready;
    return { status: "ready", identity: IDENTITY };
  },
  async search_memory(query: string): Promise<{ query: string; results: MemoryNode[] }> {
    await ready;
    const { memories } = engine.search(query);
    return { query, results: memories };
  },
};

console.log("MSTRMND MCP SERVER ONLINE");
