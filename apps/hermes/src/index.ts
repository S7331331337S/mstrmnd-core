import {
  MemoryEngine,
  resolveVaultPath,
  loadIdentity,
  WorkspaceManager,
} from "@mstrmnd/intelligence-core";
import { MstrmndPlugin } from "@mstrmnd/plugin-sdk";
import type { AgentPlan, PlanStep } from "@mstrmnd/schemas";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Planner — decomposes a goal into ordered steps using the LLM
// ---------------------------------------------------------------------------

const PLANNER_SYSTEM = `You are Hermes, an autonomous planning agent.
Given a goal, decompose it into a concise ordered list of discrete, actionable steps.
Respond with ONLY a JSON array of step description strings, no prose, no markdown fences.
Example: ["Read the existing note", "Draft new content", "Write the file"]`;

async function buildPlan(
  plugin: MstrmndPlugin,
  goal: string
): Promise<AgentPlan> {
  const raw = await plugin.generateText(goal, { system: PLANNER_SYSTEM, maxTokens: 512 });

  let descriptions: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      descriptions = parsed.map((s: unknown) => String(s));
    }
  } catch {
    // Fallback: treat each non-empty line as a step
    descriptions = raw
      .split("\n")
      .map((l) => l.replace(/^[\d\-\.\*\s]+/, "").trim())
      .filter(Boolean);
  }

  const steps: PlanStep[] = descriptions.map((description) => ({
    id: randomUUID(),
    description,
    status: "pending",
  }));

  return { goal, steps, createdAt: new Date() };
}

// ---------------------------------------------------------------------------
// Executor — runs each step with the LLM and optional workspace writes
// ---------------------------------------------------------------------------

const EXECUTOR_SYSTEM = `You are Hermes, an execution agent.
You are carrying out one step of a larger plan. The user message describes the
step. If the step requires writing a file, respond with a JSON object:
{ "action": "write_file", "path": "<relative-path>", "content": "<file-content>" }
Otherwise respond with a plain string summarising what was done or decided.`;

async function executeStep(
  plugin: MstrmndPlugin,
  workspace: WorkspaceManager,
  step: PlanStep,
  planContext: string
): Promise<string> {
  const prompt = `Plan context:\n${planContext}\n\nCurrent step: ${step.description}`;
  const raw = await plugin.generateText(prompt, {
    system: EXECUTOR_SYSTEM,
    maxTokens: 1024,
  });

  // Attempt to parse a write_file action
  try {
    const obj = JSON.parse(raw);
    if (
      obj &&
      typeof obj === "object" &&
      obj.action === "write_file" &&
      typeof obj.path === "string" &&
      typeof obj.content === "string"
    ) {
      const result = await workspace.write(obj.path, obj.content);
      if (result.written) {
        return `Wrote file: ${result.path}`;
      } else {
        return `Write blocked by policy: ${result.policyViolation}`;
      }
    }
  } catch {
    // Not a JSON action — treat as narrative result
  }

  return raw.trim();
}

// ---------------------------------------------------------------------------
// Hermes — main orchestrator
// ---------------------------------------------------------------------------

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

    // ------------------------------------------------------------------
    // Model provider: OpenAI (or Anthropic / Google via env var)
    // ------------------------------------------------------------------
    const provider =
      (process.env.HERMES_PROVIDER as "openai" | "anthropic" | "google") ??
      "openai";
    const modelId =
      process.env.HERMES_MODEL ??
      (provider === "openai"
        ? "gpt-4o-mini"
        : provider === "anthropic"
        ? "claude-3-haiku-20240307"
        : "gemini-1.5-flash");

    const apiKeyEnv =
      provider === "openai"
        ? "OPENAI_API_KEY"
        : provider === "anthropic"
        ? "ANTHROPIC_API_KEY"
        : "GOOGLE_API_KEY";

    if (!process.env[apiKeyEnv]) {
      console.log(
        `Model provider: SKIPPED — ${apiKeyEnv} not set. Set it to enable LLM orchestration.`
      );
      console.log("Use @mstrmnd/mcp-server for Cursor integration.");
      return;
    }

    const plugin = new MstrmndPlugin({ model: { provider, modelId } });
    console.log(`Model provider: ${provider}/${modelId} ready`);

    // ------------------------------------------------------------------
    // Workspace — governed writes to the vault
    // ------------------------------------------------------------------
    const workspace = new WorkspaceManager(
      WorkspaceManager.defaultConfig(vaultPath)
    );
    console.log(`Workspace: governed writes enabled (root: ${vaultPath})`);

    // ------------------------------------------------------------------
    // Demo planning loop — driven by HERMES_GOAL env var
    // ------------------------------------------------------------------
    const goal = process.env.HERMES_GOAL;
    if (!goal) {
      console.log(
        "Orchestrator: set HERMES_GOAL to run a planning loop. Example:"
      );
      console.log(
        '  HERMES_GOAL="Summarise my vault and write a daily-brief note" pnpm --filter @mstrmnd/hermes dev'
      );
      console.log("Use @mstrmnd/mcp-server for Cursor integration.");
      return;
    }

    console.log(`\nOrchestrator: building plan for goal — "${goal}"`);

    const plan = await buildPlan(plugin, goal);
    console.log(`Plan: ${plan.steps.length} steps`);
    plan.steps.forEach((s, i) =>
      console.log(`  ${i + 1}. [${s.status}] ${s.description}`)
    );

    const planContext = plan.steps.map((s) => `- ${s.description}`).join("\n");

    for (const step of plan.steps) {
      step.status = "running";
      console.log(`\nExecuting step: ${step.description}`);
      try {
        const result = await executeStep(plugin, workspace, step, planContext);
        step.status = "done";
        step.result = result;
        console.log(`  → ${result}`);
      } catch (err) {
        step.status = "error";
        step.error = String(err);
        console.error(`  ✗ ${step.error}`);
      }
    }

    const done = plan.steps.filter((s) => s.status === "done").length;
    const errored = plan.steps.filter((s) => s.status === "error").length;
    console.log(
      `\nPlan complete: ${done}/${plan.steps.length} steps succeeded${errored > 0 ? `, ${errored} failed` : ""}.`
    );
    console.log(
      `Token usage: ${plugin.usage.getTotalTokens()} total tokens consumed.`
    );
  }
}

new Hermes().start();
