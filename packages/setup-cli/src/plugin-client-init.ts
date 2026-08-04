#!/usr/bin/env node
/**
 * plugin-client-init — Client setup CLI for customer deployments.
 *
 * Usage:
 *   tsx src/plugin-client-init.ts [--headless] [--context-path ./mstrmnd-context]
 *
 * In headless mode reads from MSTRMND_ONBOARDING_JSON env var.
 * Logs a structured audit trail to <context-path>/audit.log.json.
 */

import { MstrmndPlugin } from "@mstrmnd/plugin-sdk";
import { OnboardingAgent } from "@mstrmnd/onboarding-agent";
import { generateContext, verifySeal } from "@mstrmnd/context-generator";
import type { OnboardingAnswers } from "@mstrmnd/onboarding-agent";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const headless = args.includes("--headless");
const ctxFlagIdx = args.indexOf("--context-path");
const contextPath =
  ctxFlagIdx !== -1 ? args[ctxFlagIdx + 1]! : "./mstrmnd-context";

async function main() {
  console.log("🔌 MSTRMND Client Setup\n");

  // If context already exists, verify integrity before proceeding
  if (existsSync(join(contextPath, ".mstrmnd-seal"))) {
    console.log("⚠️  Existing context detected. Verifying integrity...");
    const { verifySeal: verify } = await import("@mstrmnd/context-generator");
    const trackedFiles = [
      "identity.md",
      "config.json",
      "agents/roles.json",
      "connectors/filesystem.config.json",
    ];
    const valid = verify(contextPath, trackedFiles);
    if (!valid) {
      console.error(
        "❌ Context integrity check failed — .mstrmnd-seal mismatch. Aborting."
      );
      process.exit(1);
    }
    console.log("✅ Context integrity verified. Re-running setup will overwrite.\n");
  }

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
    console.log("Running in headless mode.\n");
  } else {
    answers = await agent.runInteractiveInterview();
  }

  console.log("\n⚙️  Generating locked context at:", contextPath);
  const result = generateContext(answers, contextPath);

  // Write audit log
  mkdirSync(contextPath, { recursive: true });
  const log = {
    event: "plugin-client-init",
    timestamp: new Date().toISOString(),
    organization: answers.companyName,
    seal: result.seal,
    version: result.version,
    usageTokens: plugin.usage.getTotalTokens(),
  };
  writeFileSync(join(contextPath, "audit.log.json"), JSON.stringify(log, null, 2), "utf-8");

  console.log("✅ Client context initialized successfully.");
  console.log(`   Path:  ${result.contextPath}`);
  console.log(`   Seal:  ${result.seal}`);
  console.log(`   Usage: ${plugin.usage.getTotalTokens()} tokens\n`);
  console.log("Next steps:");
  console.log("  1. Set your API key env var (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)");
  console.log("  2. Point your MCP config to this context path");
  console.log("  3. Start the MSTRMND MCP server\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
