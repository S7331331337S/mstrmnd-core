/**
 * mstrmnd-init — Internal MSTRMND developer setup CLI.
 *
 * Usage:
 *   pnpm --filter @mstrmnd/setup-cli init -- [--headless] [--context-path ./mstrmnd-context]
 *
 * Runs the full onboarding interview and generates the locked context folder.
 * In --headless mode, reads answers from MSTRMND_ONBOARDING_JSON env var (JSON).
 */

import { MstrmndPlugin } from "@mstrmnd/plugin-sdk";
import { OnboardingAgent } from "@mstrmnd/onboarding-agent";
import { generateContext } from "@mstrmnd/context-generator";
import type { OnboardingAnswers } from "@mstrmnd/onboarding-agent";

const args = process.argv.slice(2);
const headless = args.includes("--headless");
const contextPathFlag = args.indexOf("--context-path");
const contextPath =
  contextPathFlag !== -1 ? args[contextPathFlag + 1] : "./mstrmnd-context";

async function main() {
  console.log("🧠 MSTRMND Internal Setup\n");

  const provider = (process.env["MSTRMND_MODEL_PROVIDER"] ?? "openai") as
    | "openai"
    | "anthropic"
    | "google";
  const modelId = process.env["MSTRMND_MODEL_ID"] ?? "gpt-4o";

  const plugin = new MstrmndPlugin({
    model: { provider, modelId },
    contextPath,
  });

  const agent = new OnboardingAgent(plugin);
  let answers: OnboardingAnswers;

  if (headless) {
    const json = process.env["MSTRMND_ONBOARDING_JSON"];
    if (!json) {
      console.error(
        "Error: --headless requires MSTRMND_ONBOARDING_JSON environment variable."
      );
      process.exit(1);
    }
    answers = JSON.parse(json) as OnboardingAnswers;
    console.log("Running in headless mode — using provided JSON answers.");
  } else {
    answers = await agent.runInteractiveInterview();
  }

  console.log("\n⚙️  Generating context structure at:", contextPath);
  const result = generateContext(answers, contextPath!);

  console.log("✅ Context generated successfully.");
  console.log(`   Files: ${result.trackedFiles.join(", ")}`);
  console.log(`   Seal:  ${result.seal}`);
  console.log(`   Usage: ${plugin.usage.getTotalTokens()} total tokens\n`);

  writeAuditLog(contextPath!, answers, result.seal);
}

function writeAuditLog(
  contextPath: string,
  answers: OnboardingAnswers,
  seal: string
): void {
  import("fs").then(({ writeFileSync, mkdirSync }) => {
    import("path").then(({ join }) => {
      mkdirSync(contextPath, { recursive: true });
      const log = {
        event: "mstrmnd-init",
        timestamp: new Date().toISOString(),
        organization: answers.companyName,
        seal,
      };
      writeFileSync(
        join(contextPath, "audit.log.json"),
        JSON.stringify(log, null, 2),
        "utf-8"
      );
    });
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
