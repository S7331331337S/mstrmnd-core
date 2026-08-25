import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AgentSpec,
  AgentStep,
  AuditEvent,
  ContextPack,
  RunState,
  SubAgentHandoff,
  ThreatBoundary,
} from "@mstrmnd/schemas";
import type { ModelProvider } from "./model-provider";
import { EchoProvider } from "./model-provider";
import type { WorkspaceService } from "./workspace-service";
import type { MemoryEngine } from "./memory-engine";
import { localProvenance, nowIso } from "./operator-scope";
import { resolveRepoRoot } from "./doctrine-loader";
import {
  assertBoundary,
  evaluateBoundaryAction,
} from "./policy-boundary";

export const OPERATOR_AGENT: AgentSpec = {
  id: "operator-agent",
  role: "parent",
  description: "Operator Zero parent agent — context, memory, workspace, sub-agents",
  toolsAllowlist: [
    "search_memory",
    "list_workspace",
    "read_file",
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

export interface OrchestratorDeps {
  context: ContextPack;
  memory?: MemoryEngine;
  workspace?: WorkspaceService;
  provider?: ModelProvider;
  repoRoot?: string;
  dryRun?: boolean;
  /** Mandatory. Dispatch is refused without a valid threat boundary. */
  boundary: ThreatBoundary;
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
    assertBoundary(this.deps.boundary);
    const root = resolveRepoRoot(deps.repoRoot);
    this.runsDir = join(root, ".mstrmnd", "runs");
    this.auditPath = join(root, ".mstrmnd", "audit.jsonl");
  }

  getBoundary(): ThreatBoundary {
    return this.deps.boundary;
  }

  createRun(agentId: string, goal: string): RunState {
    const spec = getAgentSpec(agentId);
    if (!spec) throw new Error(`unknown agent: ${agentId}`);
    assertBoundary(this.deps.boundary);
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
      boundaryId: this.deps.boundary.id,
      costAccruedUsd: 0,
    };
  }

  async dispatch(run: RunState): Promise<RunState> {
    assertBoundary(this.deps.boundary);
    run.boundaryId = this.deps.boundary.id;
    run.status = "running";
    run.updatedAt = nowIso();
    const parent = getAgentSpec(run.parentAgentId)!;
    await this.audit({
      kind: "policy.boundary",
      summary: `Threat boundary ${this.deps.boundary.id} attached`,
      data: {
        boundaryId: this.deps.boundary.id,
        network: this.deps.boundary.networkAllowlist,
        mcp: this.deps.boundary.mcpAllowlist,
        costCeilingUsd: this.deps.boundary.costCeilingUsd,
        tools: this.deps.boundary.toolsAllowlist,
      },
      outcome: "success",
    });

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

    // Sub-agent: list workspace root (still inside the parent threat boundary)
    if (this.deps.workspace && child.toolsAllowlist.includes("list_workspace")) {
      const mounts = this.deps.workspace.listMounts();
      if (mounts[0]) {
        const fsDecision = evaluateBoundaryAction(this.deps.boundary, {
          toolId: "list_workspace",
          filesystem: { mountId: mounts[0].id, path: "" },
        });
        await this.audit({
          kind: "policy.decision",
          summary: `Policy ${fsDecision.outcome} for ${childId}:list_workspace`,
          data: { decision: fsDecision, boundaryId: this.deps.boundary.id },
          policyDecisionId: fsDecision.id,
          outcome:
            fsDecision.outcome === "allow"
              ? "success"
              : fsDecision.outcome === "deny"
                ? "denied"
                : "pending_approval",
        });
        if (fsDecision.outcome !== "allow") {
          this.pushStep(parent, {
            type: "approval",
            summary: `blocked ${childId}:list_workspace: ${fsDecision.reason}`,
            toolId: "list_workspace",
            agentId: childId,
            status: "error",
          });
        } else {
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
    const mountId = String(
      args.mountId ?? this.deps.workspace?.listMounts()[0]?.id ?? ""
    );
    const path = String(args.path ?? "");
    const needsFs = toolId === "list_workspace" || toolId === "read_file";
    const decision = evaluateBoundaryAction(this.deps.boundary, {
      toolId,
      filesystem: needsFs && mountId ? { mountId, path } : undefined,
      accruedCostUsd: run.costAccruedUsd ?? 0,
      estimatedCostUsd: 0,
    });
    await this.audit({
      kind: "policy.decision",
      summary: `Policy ${decision.outcome} for ${toolId}`,
      data: { decision, boundaryId: this.deps.boundary.id },
      policyDecisionId: decision.id,
      outcome:
        decision.outcome === "allow"
          ? "success"
          : decision.outcome === "deny"
            ? "denied"
            : "pending_approval",
    });

    if (decision.outcome !== "allow") {
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
      const nodes = await this.deps.workspace.list(mountId, path);
      output = JSON.stringify(nodes.slice(0, 50));
    } else if (toolId === "read_file" && this.deps.workspace) {
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
