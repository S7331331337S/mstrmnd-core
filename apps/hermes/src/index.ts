import {
  createRuntime,
  OPERATOR_AGENT,
} from "@mstrmnd/intelligence-core";
import { existsSync } from "node:fs";

function parseArgs(argv: string[]) {
  const out: {
    goal: string;
    agent: string;
    dryRun: boolean;
    help: boolean;
  } = {
    goal: "Summarize Operator Zero context and workspace",
    agent: OPERATOR_AGENT.id,
    dryRun: false,
    help: false,
  };
  const args = argv.filter((a) => a !== "--");
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--goal") out.goal = args[++i] ?? out.goal;
    else if (a === "--agent") out.agent = args[++i] ?? out.agent;
  }
  return out;
}

export class Hermes {
  async start() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(`Hermes — MSTRMND orchestrator shell

Usage:
  pnpm hermes [--goal "..."] [--agent operator-agent] [--dry-run]

Boots the shared runtime (context, memory, workspace), then dispatches
the parent agent. Default model provider is echo (offline).
`);
      return;
    }

    console.log("HERMES ONLINE");
    console.log("Runtime: initializing");

    const runtime = await createRuntime({ allowMissingVault: true });
    const { context, memory, workspace, config } = runtime;

    if (!existsSync(config.vaultPath)) {
      console.log(
        `Memory substrate: WARNING vault not found at ${config.vaultPath}`
      );
      console.log("Set OBSIDIAN_VAULT_PATH to your Obsidian vault directory.");
      console.log("Continuing with templates + doctrine context only.");
    } else {
      console.log(
        `Memory substrate: loaded ${memory.size} notes from vault`
      );
    }

    console.log(
      `Context: company=${context.company.name} operator=${context.operator.displayName}`
    );
    console.log(
      `Scope: org=${context.scope.organizationId} workspace=${context.scope.workspaceId} user=${context.scope.userId}`
    );
    console.log(`Doctrine: ${context.doctrineRef ?? "unpinned"}`);
    console.log(
      `Workspace mounts: ${workspace
        .listMounts()
        .map((m) => m.id)
        .join(", ") || "none"}`
    );

    const identity = runtime.identity;
    const profileLoaded =
      identity.values.length > 0 || identity.interests.length > 0;
    console.log(
      profileLoaded
        ? `Identity profile: ${identity.values.length} values, ${identity.interests.length} interests`
        : "Identity profile: not found (add identity.md to vault or templates)"
    );

    console.log(`Dispatch: agent=${args.agent} dryRun=${args.dryRun}`);
    console.log(`Goal: ${args.goal}`);

    const orch = runtime.createOrchestrator({ dryRun: args.dryRun });
    const run = orch.createRun(args.agent, args.goal);
    const finished = await orch.dispatch(run);

    console.log(`Run ${finished.runId}: ${finished.status}`);
    console.log(`Steps: ${finished.steps.length}`);
    if (finished.resultSummary) {
      console.log("Result:");
      console.log(finished.resultSummary);
    }
    if (finished.error) {
      console.log(`Error: ${finished.error}`);
    }
    console.log("Use @mstrmnd/mcp-server for Cursor plugin integration.");
  }
}

new Hermes().start().catch((err) => {
  console.error("HERMES fatal:", err);
  process.exit(1);
});
