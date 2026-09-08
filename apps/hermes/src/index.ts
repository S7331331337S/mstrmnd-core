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
    approve?: string;
    reject?: string;
    show?: string;
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
    else if (a === "--approve") out.approve = args[++i];
    else if (a === "--reject") out.reject = args[++i];
    else if (a === "--show") out.show = args[++i];
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
  pnpm hermes -- --show <runId>
  pnpm hermes -- --approve <runId>
  pnpm hermes -- --reject <runId>

Boots the shared runtime (context, memory, workspace), then dispatches
the parent agent. Default model provider is echo (offline).

Writes never touch the vault. draft_write lands under .mstrmnd/drafts;
--approve copies them to .mstrmnd/staging. There is no env bypass.
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
    console.log(`Model provider: ${runtime.provider.id}`);
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

    const orch = runtime.createOrchestrator({ dryRun: args.dryRun });
    const actorId = context.operator.id || context.scope.userId;

    if (args.show) {
      const run = await orch.loadRun(args.show);
      console.log(JSON.stringify(run, null, 2));
      return;
    }
    if (args.approve) {
      const run = await orch.approve(args.approve, actorId);
      console.log(`Run ${run.runId}: ${run.status}`);
      console.log(`Published: ${(run.publishedPaths ?? []).join(", ") || "(none)"}`);
      return;
    }
    if (args.reject) {
      const run = await orch.reject(args.reject, actorId);
      console.log(`Run ${run.runId}: ${run.status}`);
      return;
    }

    console.log(`Dispatch: agent=${args.agent} dryRun=${args.dryRun}`);
    console.log(`Goal: ${args.goal}`);

    const run = orch.createRun(args.agent, args.goal);
    const finished = await orch.dispatch(run);

    console.log(`Run ${finished.runId}: ${finished.status}`);
    console.log(`Steps: ${finished.steps.length}`);
    if (finished.status === "waiting") {
      console.log(
        `Awaiting approval to publish drafts: ${(finished.pendingApproval?.draftPaths ?? []).join(", ")}`
      );
      console.log(`Approve: pnpm hermes -- --approve ${finished.runId}`);
      console.log(`Reject:  pnpm hermes -- --reject ${finished.runId}`);
    }
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
