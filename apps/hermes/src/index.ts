import { MemoryEngine, resolveVaultPath, loadIdentity } from "@mstrmnd/intelligence-core";
import { existsSync } from "node:fs";

export class Hermes {
  private memory = new MemoryEngine();

  async start() {
    console.log("HERMES ONLINE");
    console.log("Memory substrate: initializing");

    const vaultPath = resolveVaultPath();
    if (!existsSync(vaultPath)) {
      console.log(`Memory substrate: WARNING vault not found at ${vaultPath}`);
      console.log("Set OBSIDIAN_VAULT_PATH to your Obsidian vault directory.");
      return;
    }

    const nodes = await this.memory.loadVault(vaultPath);
    console.log(`Memory substrate: loaded ${nodes.length} notes from vault`);

    const identity = await loadIdentity(vaultPath);
    const profileLoaded =
      identity.values.length > 0 || identity.interests.length > 0;
    console.log(
      profileLoaded
        ? `Identity profile: ${identity.values.length} values, ${identity.interests.length} interests`
        : "Identity profile: not found (add identity.md to vault)"
    );

    const titles = nodes.slice(0, 5).map((n) => n.title);
    console.log("Indexed sample: " + titles.join(" | "));
    console.log("Use @mstrmnd/mcp-server for Cursor integration.");
  }
}

new Hermes().start();
