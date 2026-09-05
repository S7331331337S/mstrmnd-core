import {
  createRuntime,
  denyApprover,
  isInteractiveSession,
  OPERATOR_AGENT,
} from "@mstrmnd/intelligence-core";
import { existsSync } from "node:fs";
import { createApprover } from "./approval";

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
Workspace writes are staged as drafts under .mstrmnd/drafts/ and published
only after explicit y/yes. Non-interactive and --dry-run never publish.
There is no flag that disables the approval gate.
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

    console.log(`Dispatch: agent=${args.agent} dryRun=${args.dryRun}`);
    console.log(`Goal: ${args.goal}`);

    const writeApprover = args.dryRun ? denyApprover : createApprover();
    if (args.dryRun) {
      console.log(
        "Approval gate: dry-run — workspace writes are not staged or published."
      );
    } else {
      console.log(
        isInteractiveSession()
          ? "Approval gate: interactive — each write is drafted and must be approved (y/yes)."
          : "Approval gate: non-interactive — writes are drafted to .mstrmnd/drafts and never published."
      );
    }

    const orch = runtime.createOrchestrator({
      dryRun: args.dryRun,
      writeApprover,
    });
    const boundary = orch.getBoundary();
    console.log(
      `Threat boundary: id=${boundary.id} workflow=${boundary.workflowId} tools=${boundary.toolsAllowlist.join(",")} mounts=${
        boundary.filesystemScope.map((e) => e.mountId).join(",") || "none"
      } costCeilingUsd=${boundary.costCeilingUsd} network=${
        boundary.networkAllowlist.length === 0 ? "deny-all" : boundary.networkAllowlist.join(",")
      }`
    );
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
