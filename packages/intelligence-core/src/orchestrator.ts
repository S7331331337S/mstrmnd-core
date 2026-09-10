import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AgentSpec,
  AgentStep,
  AuditEvent,
  ContextPack,
  PolicyDecision,
  PolicyOutcome,
  RunState,
  SubAgentHandoff,
} from "@mstrmnd/schemas";
import { CONSEQUENTIAL_ACTIONS } from "@mstrmnd/schemas";
import type { ModelProvider } from "./model-provider";
import { EchoProvider } from "./model-provider";
import type { WorkspaceService } from "./workspace-service";
import type { MemoryEngine } from "./memory-engine";
import {
  denyApprover,
  stageAndMaybePublish,
  type WriteApprover,
} from "./write-approval";
import { localProvenance, nowIso } from "./operator-scope";
import { resolveRepoRoot } from "./doctrine-loader";

export const OPERATOR_AGENT: AgentSpec = {
  id: "operator-agent",
  role: "parent",
  description: "Operator Zero parent agent — context, memory, workspace, sub-agents",
  toolsAllowlist: [
    "search_memory",
    "list_workspace",
    "read_file",
    "write_file",
    "get_context",
    "spawn_subagent",
  ],
  modelHint: "general",
  subAgentsAllowlist: ["workspace-scout"],
};

export const WORKSPACE_SCOUT: AgentSpec = {
  id: "workspace-scout",
  role: "subagent",
  description: "List and summarize workspace folders/files (read-only)",
  toolsAllowlist: ["list_workspace", "read_file"],
  modelHint: "fast",
};

const SPECS: Record<string, AgentSpec> = {
  [OPERATOR_AGENT.id]: OPERATOR_AGENT,
  [WORKSPACE_SCOUT.id]: WORKSPACE_SCOUT,
};

export function getAgentSpec(id: string): AgentSpec | undefined {
  return SPECS[id];
}

export function listAgentSpecs(): AgentSpec[] {
  return Object.values(SPECS);
}

function evaluateToolPolicy(
  toolId: string,
  scope: RunState["scope"]
): PolicyDecision {
  const consequential = (CONSEQUENTIAL_ACTIONS as readonly string[]).some((a) =>
    toolId.includes(a.split(".").pop() ?? a)
  );
  const writeLike = /write|delete|publish|stage|send/i.test(toolId);
  let outcome: PolicyOutcome = "allow";
  let reason = "read/search tools are allowed for Operator Zero";
  if (writeLike || consequential) {
    outcome = "require-approval";
    reason = "consequential or write tool requires approval";
  }
  return {
    id: randomUUID(),
    at: nowIso(),
    outcome,
    action: toolId,
    scope,
    reason,
  };
}

export interface OrchestratorDeps {
  context: ContextPack;
  memory?: MemoryEngine;
  workspace?: WorkspaceService;
  provider?: ModelProvider;
  repoRoot?: string;
  dryRun?: boolean;
  /** Human-approval callback for write_file. Defaults to deny (never auto-publish). */
  writeApprover?: WriteApprover;
}

export class Orchestrator {
  private deps: OrchestratorDeps;
  private runsDir: string;
  private auditPath: string;

  constructor(deps: OrchestratorDeps) {
    this.deps = {
      provider: deps.provider ?? new EchoProvider(),
      ...deps,
    };
    const root = resolveRepoRoot(deps.repoRoot);
    this.runsDir = join(root, ".mstrmnd", "runs");
    this.auditPath = join(root, ".mstrmnd", "audit.jsonl");
  }

  createRun(agentId: string, goal: string): RunState {
    const spec = getAgentSpec(agentId);
    if (!spec) throw new Error(`unknown agent: ${agentId}`);
    const now = nowIso();
    return {
      runId: randomUUID(),
      status: "pending",
      scope: this.deps.context.scope,
      doctrineRef: this.deps.context.doctrineRef,
      parentAgentId: agentId,
      goal,
      steps: [],
      createdAt: now,
      updatedAt: now,
      provenance: localProvenance("orchestrator", {
        adapter: "orchestrator",
        doctrineRef: this.deps.context.doctrineRef ?? undefined,
        producedBy: agentId,
      }),
      handoffs: [],
    };
  }

  async dispatch(run: RunState): Promise<RunState> {
    run.status = "running";
    run.updatedAt = nowIso();
    const parent = getAgentSpec(run.parentAgentId)!;

    try {
      // Step 1: model plans from context
      const planPrompt = this.buildPlanPrompt(run, parent);
      const plan = await this.deps.provider!.complete([
        {
          role: "system",
          content:
            "You are the MSTRMND operator agent. Propose brief next tools as JSON array of {tool,args}.",
        },
        { role: "user", content: planPrompt },
      ]);
      this.pushStep(run, {
        type: "model",
        summary: "parent model plan",
        outputSummary: plan.slice(0, 500),
        status: "ok",
      });

      // Step 2: memory search if available
      if (
        parent.toolsAllowlist.includes("search_memory") &&
        this.deps.memory
      ) {
        await this.runTool(run, parent, "search_memory", {
          query: run.goal,
          limit: 5,
        });
      }

      // Step 3: spawn workspace-scout sub-agent once
      if (
        parent.subAgentsAllowlist?.includes("workspace-scout") &&
        this.deps.workspace
      ) {
        await this.runSubAgent(run, "workspace-scout", `Scout workspace for: ${run.goal}`);
      }

      // Step 4: final model synthesis
      const synthesis = await this.deps.provider!.complete([
        {
          role: "system",
          content: "Summarize operator run results for the human.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              goal: run.goal,
              steps: run.steps.map((s) => ({
                type: s.type,
                summary: s.summary,
                output: s.outputSummary,
              })),
              context: {
                company: this.deps.context.company.name,
                operator: this.deps.context.operator.displayName,
                doctrineRef: this.deps.context.doctrineRef,
              },
            },
            null,
            2
          ),
        },
      ]);
      this.pushStep(run, {
        type: "model",
        summary: "final synthesis",
        outputSummary: synthesis.slice(0, 1000),
        status: "ok",
      });

      run.status = "succeeded";
      run.resultSummary = synthesis.slice(0, 2000);
    } catch (err) {
      run.status = "failed";
      run.error = err instanceof Error ? err.message : String(err);
      this.pushStep(run, {
        type: "model",
        summary: "run failed",
        outputSummary: run.error,
        status: "error",
      });
    }

    run.updatedAt = nowIso();
    if (!this.deps.dryRun) {
      await this.persistRun(run);
    }
    return run;
  }

  private buildPlanPrompt(run: RunState, agent: AgentSpec): string {
    const ctx = this.deps.context;
    return [
      `Goal: ${run.goal}`,
      `Agent: ${agent.id} (${agent.role})`,
      `Company: ${ctx.company.name} — ${ctx.company.missionSummary ?? ""}`,
      `Operator: ${ctx.operator.displayName}`,
      `Doctrine: ${ctx.doctrineRef ?? "unpinned"}`,
      `Tools: ${agent.toolsAllowlist.join(", ")}`,
      `Memory hits: ${ctx.memoryHits.length}`,
      `Workspace roots: ${ctx.workspaceRoots.join(", ") || "none"}`,
    ].join("\n");
  }

  private async runSubAgent(
    parent: RunState,
    childId: string,
    goal: string
  ): Promise<void> {
    const child = getAgentSpec(childId);
    if (!child) throw new Error(`unknown sub-agent: ${childId}`);
    const handoff: SubAgentHandoff = {
      parentRunId: parent.runId,
      childAgentId: childId,
      goal,
      allowedTools: [...child.toolsAllowlist],
    };

    this.pushStep(parent, {
      type: "subagent",
      summary: `spawn ${childId}`,
      agentId: childId,
      inputSummary: goal,
      status: "ok",
    });
    await this.audit({
      kind: "agent.subagent.start",
      summary: `Sub-agent ${childId} started`,
      data: { parentRunId: parent.runId, childId, goal },
      outcome: "success",
    });

    // Sub-agent: list workspace root
    if (this.deps.workspace && child.toolsAllowlist.includes("list_workspace")) {
      const mounts = this.deps.workspace.listMounts();
      if (mounts[0]) {
        const listing = await this.deps.workspace.list(mounts[0].id, "");
        handoff.result = {
          mountId: mounts[0].id,
          entries: listing.slice(0, 30).map((n) => ({
            path: n.path,
            kind: n.kind,
          })),
        };
        this.pushStep(parent, {
          type: "tool",
          summary: `${childId}: list_workspace`,
          toolId: "list_workspace",
          agentId: childId,
          outputSummary: JSON.stringify(handoff.result).slice(0, 500),
          status: "ok",
        });
      }
    }

    parent.handoffs = [...(parent.handoffs ?? []), handoff];
  }

  private async runTool(
    run: RunState,
    agent: AgentSpec,
    toolId: string,
    args: Record<string, unknown>
  ): Promise<void> {
    if (!agent.toolsAllowlist.includes(toolId)) {
      throw new Error(`tool ${toolId} not allowed for ${agent.id}`);
    }
    const decision = evaluateToolPolicy(toolId, run.scope);
    await this.audit({
      kind: "policy.decision",
      summary: `Policy ${decision.outcome} for ${toolId}`,
      data: { decision },
      policyDecisionId: decision.id,
      outcome:
        decision.outcome === "allow"
          ? "success"
          : decision.outcome === "deny"
            ? "denied"
            : "pending_approval",
    });

    if (decision.outcome === "deny") {
      this.pushStep(run, {
        type: "approval",
        summary: `denied ${toolId}: ${decision.reason}`,
        toolId,
        status: "error",
      });
      return;
    }

    if (
      decision.outcome === "require-approval" &&
      toolId !== "write_file"
    ) {
      this.pushStep(run, {
        type: "approval",
        summary: `blocked ${toolId}: ${decision.reason}`,
        toolId,
        status: "error",
      });
      return;
    }

    let output = "";
    if (toolId === "search_memory" && this.deps.memory) {
      const q = String(args.query ?? "");
      const limit = Number(args.limit ?? 5);
      const { memories } = this.deps.memory.search(q);
      output = JSON.stringify(
        memories.slice(0, limit).map((m) => ({
          id: m.id,
          title: m.title,
        }))
      );
    } else if (toolId === "list_workspace" && this.deps.workspace) {
      const mountId = String(
        args.mountId ?? this.deps.workspace.listMounts()[0]?.id ?? ""
      );
      const path = String(args.path ?? "");
      const nodes = await this.deps.workspace.list(mountId, path);
      output = JSON.stringify(nodes.slice(0, 50));
    } else if (toolId === "read_file" && this.deps.workspace) {
      const mountId = String(
        args.mountId ?? this.deps.workspace.listMounts()[0]?.id ?? ""
      );
      const path = String(args.path ?? "");
      const file = await this.deps.workspace.read(mountId, path);
      output = JSON.stringify({
        path: file.path,
        truncated: file.truncated,
        preview: file.content.slice(0, 500),
      });
    } else if (toolId === "get_context") {
      output = JSON.stringify({
        company: this.deps.context.company.name,
        operator: this.deps.context.operator.displayName,
        doctrineRef: this.deps.context.doctrineRef,
      });
    } else if (toolId === "write_file" && this.deps.workspace) {
      const mountId = String(args.mountId ?? "vault");
      const targetPath = String(args.path ?? "");
      const content = String(args.content ?? "");
      const outcome = await stageAndMaybePublish(
        this.deps.workspace,
        this.deps.writeApprover ?? denyApprover,
        mountId,
        targetPath,
        content,
        { dryRun: this.deps.dryRun }
      );
      output = JSON.stringify({
        published: outcome.published,
        draftId: outcome.draft?.id,
        draftPath: outcome.draft?.draftPath,
        message: outcome.message,
      });
      this.pushStep(run, {
        type: outcome.published ? "tool" : "approval",
        summary: outcome.message,
        toolId,
        inputSummary: JSON.stringify({
          mountId,
          path: targetPath,
        }).slice(0, 300),
        outputSummary: output.slice(0, 800),
        status: outcome.published || this.deps.dryRun ? "ok" : "pending",
      });
      await this.audit({
        kind: outcome.published ? "tool.call" : "approval.requested",
        summary: outcome.message,
        data: { toolId, args: { mountId, path: targetPath }, preview: output.slice(0, 200) },
        outcome: outcome.published ? "success" : "pending_approval",
      });
      return;
    } else {
      output = JSON.stringify({ skipped: true, toolId });
    }

    this.pushStep(run, {
      type: "tool",
      summary: `tool ${toolId}`,
      toolId,
      inputSummary: JSON.stringify(args).slice(0, 300),
      outputSummary: output.slice(0, 800),
      status: "ok",
    });
    await this.audit({
      kind: "tool.call",
      summary: `Tool ${toolId}`,
      data: { toolId, args, preview: output.slice(0, 200) },
      outcome: "success",
    });
  }

  private pushStep(
    run: RunState,
    partial: Omit<AgentStep, "id" | "at"> & { type: AgentStep["type"] }
  ): void {
    run.steps.push({
      id: randomUUID(),
      at: nowIso(),
      ...partial,
    });
    run.updatedAt = nowIso();
  }

  private async persistRun(run: RunState): Promise<void> {
    if (!existsSync(this.runsDir)) {
      await mkdir(this.runsDir, { recursive: true });
    }
    const path = join(this.runsDir, `${run.runId}.json`);
    await writeFile(path, JSON.stringify(run, null, 2), "utf8");
  }

  private async audit(
    partial: Pick<AuditEvent, "kind" | "summary"> &
      Partial<Omit<AuditEvent, "id" | "at" | "scope" | "actor" | "kind" | "summary">>
  ): Promise<void> {
    if (this.deps.dryRun) return;
    const event: AuditEvent = {
      id: randomUUID(),
      at: nowIso(),
      kind: partial.kind,
      summary: partial.summary,
      scope: this.deps.context.scope,
      actor: { type: "agent", id: "orchestrator" },
      data: partial.data,
      policyDecisionId: partial.policyDecisionId,
      outcome: partial.outcome,
    };
    const dir = join(resolveRepoRoot(this.deps.repoRoot), ".mstrmnd");
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await appendFile(this.auditPath, JSON.stringify(event) + "\n", "utf8");
  }
}
