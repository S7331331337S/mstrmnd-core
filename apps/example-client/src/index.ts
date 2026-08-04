/**
 * Example customer integration demonstrating the MSTRMND plugin layer.
 *
 * This shows how a customer application would:
 * 1. Initialize the plugin with their model preference
 * 2. Run headless onboarding (or interactive)
 * 3. Generate the locked context structure
 * 4. Use the MstrmndPlugin for LLM calls with token tracking
 *
 * Run: tsx src/index.ts
 * (Requires OPENAI_API_KEY or the relevant provider key)
 */

import { MstrmndPlugin } from "@mstrmnd/plugin-sdk";
import { OnboardingAgent } from "@mstrmnd/onboarding-agent";
import { generateContext, verifySeal } from "@mstrmnd/context-generator";

const CONTEXT_PATH = "./example-context";

async function main() {
  console.log("=== MSTRMND Example Client Integration ===\n");

  // 1. Instantiate the plugin
  const plugin = new MstrmndPlugin({
    model: {
      provider: "openai",
      modelId: "gpt-4o",
      // apiKey: "sk-..." — or set OPENAI_API_KEY env var
    },
    contextPath: CONTEXT_PATH,
  });

  console.log("Plugin initialized with model: openai/gpt-4o");

  // 2. Run headless onboarding (in a real integration you'd call runInteractiveInterview)
  const agent = new OnboardingAgent(plugin);
  const answers = await agent.extractFromDescription(
    `We are Acme Corp, a fintech company. Our vault is at /data/acme-vault.
     We prefer OpenAI gpt-4o. Our agents should be able to research, summarize, and trade.
     We have a Slack integration at https://hooks.slack.com/services/example.
     Contact: admin@acme.com`
  );

  console.log("\nOnboarding answers extracted:");
  console.log(`  Company: ${answers.companyName}`);
  console.log(`  Domain:  ${answers.domain}`);
  console.log(`  Model:   ${answers.modelPreference}/${answers.modelId}`);
  console.log(`  Roles:   ${answers.customAgentRoles.join(", ")}`);

  // 3. Generate locked context structure
  console.log("\nGenerating locked context structure...");
  const ctx = generateContext(answers, CONTEXT_PATH);
  console.log(`  Seal: ${ctx.seal}`);

  // 4. Verify integrity
  const valid = verifySeal(CONTEXT_PATH, ctx.trackedFiles);
  console.log(`  Integrity valid: ${valid}`);

  // 5. Show token usage
  console.log(`\nTotal tokens used: ${plugin.usage.getTotalTokens()}`);
  console.log("\n✅ Example integration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
