import { MemoryEngine } from "@mstrmnd/intelligence-core";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

function resolveVaultPath(): string {
  // Allow override via OBSIDIAN_VAULT_PATH, else default to the user's vault.
  const fromEnv = process.env.OBSIDIAN_VAULT_PATH;
  if (fromEnv) return fromEnv;
  return `${process.env.HOME}/Documents/Obsidian Vault`;
}

export class Hermes {
  private memory = new MemoryEngine();

  async start() {
    console.log("HERMES ONLINE");
    console.log("Memory substrate: initializing");

    const vaultPath = resolveVaultPath();
    if (!existsSync(vaultPath)) {
      console.log(`Reflection loop: WARNING vault not found at ${vaultPath}`);
      return;
    }

    const nodes = await this.memory.loadVault(vaultPath);
    console.log(`Memory substrate: loaded ${nodes.length} notes from vault`);

    const titles = nodes.slice(0, 5).map((n) => n.title);
    console.log("Indexed sample: " + titles.join(" | "));

    console.log("Reflection loop: active");
  }
}

new Hermes().start();
