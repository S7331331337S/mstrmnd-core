import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import {
  MemoryEngine,
  VectorEngine,
  resolveVaultPath,
  resolveEmbeddingProvider,
  loadIdentity,
} from "@mstrmnd/intelligence-core";
import { HermesAgent, resolveReasoner } from "@mstrmnd/agents";

export class Hermes {
  async start(): Promise<void> {
    console.log("HERMES ONLINE");

    const vaultPath = resolveVaultPath();
    if (!existsSync(vaultPath)) {
      console.log(`Memory substrate: WARNING vault not found at ${vaultPath}`);
      console.log("Set OBSIDIAN_VAULT_PATH to your Obsidian vault directory.");
      return;
    }

    const provider = await resolveEmbeddingProvider();
    const memory = new MemoryEngine(new VectorEngine(provider));
    const nodes = await memory.loadVault(vaultPath);
    console.log(`Memory substrate: ${nodes.length} notes from ${vaultPath}`);

    const indexed = await memory.buildVectorIndex();
    console.log(`Embeddings: ${indexed} vectors via ${provider.name}`);
    console.log(`Graph: ${memory.relationships.size} edges`);

    const identity = await loadIdentity(vaultPath);
    const profileLoaded = identity.values.length > 0 || identity.interests.length > 0;
    console.log(
      profileLoaded
        ? `Identity: ${identity.values.length} values, ${identity.interests.length} interests`
        : "Identity: not found (add identity.md to vault)"
    );

    const reasoner = await resolveReasoner();
    console.log(`Reasoner: ${reasoner.name}`);

    const agent = new HermesAgent(memory, reasoner, identity);

    // Non-interactive invocation (`pnpm hermes -- "question"`, or piped stdin)
    // answers once and exits, so the loop is scriptable as well as interactive.
    const argQuestion = process.argv.slice(2).join(" ").trim();
    if (argQuestion) {
      await this.answerOnce(agent, argQuestion);
      return;
    }
    if (!process.stdin.isTTY) {
      console.log("(no TTY — pass a question as an argument to query)");
      return;
    }

    await this.loop(agent);
  }

  private async answerOnce(agent: HermesAgent, question: string): Promise<void> {
    const result = await agent.ask(question);
    console.log(`\n${result.answer}\n`);
  }

  private async loop(agent: HermesAgent): Promise<void> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log("\nAsk your memory. 'reset' clears context, 'exit' quits.\n");

    try {
      for (;;) {
        const line = (await rl.question("› ")).trim();
        if (!line) continue;
        if (line === "exit" || line === "quit") break;
        if (line === "reset") {
          agent.reset();
          console.log("Context cleared.\n");
          continue;
        }
        try {
          const result = await agent.ask(line);
          console.log(`\n${result.answer}\n`);
          if (result.passages.length > 0) {
            const cited = result.passages.map((p) => p.id).join(", ");
            console.log(`  grounded in: ${cited}\n`);
          }
        } catch (err) {
          // One bad turn shouldn't end the session.
          console.error("Turn failed:", err instanceof Error ? err.message : err);
        }
      }
    } finally {
      rl.close();
    }
  }
}

new Hermes().start().catch((err) => {
  console.error("HERMES fatal:", err);
  process.exit(1);
});
