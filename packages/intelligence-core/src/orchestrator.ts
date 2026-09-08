import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
} from "@mstrmnd/schemas";
import type { ModelProvider } from "./model-provider";
import { EchoProvider } from "./model-provider";
import type { WorkspaceService } from "./workspace-service";
import type { MemoryEngine } from "./memory-engine";
import { localProvenance, nowIso } from "./operator-scope";
import { resolveRepoRoot } from "./doctrine-loader";
import { evaluateToolPolicy, TOOL_DRAFT_WRITE, TOOL_PUBLISH_DRAFTS } from "./policy";
import { MAX_PLAN_TOOLS, parseToolPlan, type ProposedToolCall } from "./plan-parser";
import { graphIncludes, loadAgentGraph, type AgentGraph } from "./agent-graph";

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
    TOOL_DRAFT_WRITE,
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
}

export class Orchestrator {
  private deps: OrchestratorDeps;
  private runsDir: string;
  private auditPath: string;
  private graph: AgentGraph | null;

  constructor(deps: OrchestratorDeps) {
    this.deps = {
      provider: deps.provider ?? new EchoProvider(),
      ...deps,
    };
    const root = resolveRepoRoot(deps.repoRoot);
    this.runsDir = join(root, ".mstrmnd", "runs");
    this.auditPath = join(root, ".mstrmnd", "audit.jsonl");
    this.graph = loadAgentGraph(root);
  }

  createRun(agentId: string, goal: string): RunState {
    const spec = getAgentSpec(agentId);
    if (!spec) throw new Error(`unknown agent: ${agentId}`);
    if (!graphIncludes(this.graph, agentId)) {
      throw new Error(`agent ${agentId} is not in operator agent-graph.json`);
    }
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
      const planPrompt = this.buildPlanPrompt(run, parent);
      const plan = await this.deps.provider!.complete([
        {
          role: "system",
          content:
            "You are the MSTRMND operator agent. Propose brief next tools as JSON array of {tool,args}. Use only allowlisted tools. draft_write is the only write tool; never write the vault.",
        },
        { role: "user", content: planPrompt },
      ]);
      this.pushStep(run, {
        type: "model",
        summary: "parent model plan",
        outputSummary: plan.slice(0, 500),
        status: "ok",
      });

      const proposed = parseToolPlan(plan);
      if (proposed) {
        await this.executeProposed(run, parent, proposed);
      } else {
        await this.executeFallback(run, parent);
      }

      if (run.pendingApproval) {
        const waitingNote = await this.synthesize(
          run,
          "waiting for human approval"
        );
        run.resultSummary = waitingNote.slice(0, 2000);
        run.status = "waiting";
        await this.persistRun(run);
        return run;
      }

      const draftPaths = this.deps.workspace
        ? await this.deps.workspace.listDrafts(run.runId)
        : [];
      if (draftPaths.length > 0) {
        await this.requestPublishApproval(run, draftPaths);
        const waitingNote = await this.synthesize(run, "waiting for human approval to publish drafts to staging");
        run.resultSummary = waitingNote.slice(0, 2000);
        await this.persistRun(run);
        return run;
      }

      const synthesis = await this.synthesize(run, "final synthesis for the human");
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
    await this.persistRun(run);
    return run;
  }

  async loadRun(runId: string): Promise<RunState> {
    const path = join(this.runsDir, `${runId}.json`);
    if (!existsSync(path)) {
      throw new Error(`run not found: ${runId}`);
    }
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as RunState;
  }

  async listRuns(): Promise<string[]> {
    if (!existsSync(this.runsDir)) return [];
    const names = await readdir(this.runsDir);
    return names
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.slice(0, -".json".length))
      .sort();
  }

  /** Publish drafts to staging. Idempotent for an already-approved run. */
  async approve(runId: string, actorId: string): Promise<RunState> {
    const run = await this.loadRun(runId);
    if (run.approval?.outcome === "approved" && run.status === "succeeded") {
      return run;
    }
    if (run.status !== "waiting") {
      throw new Error(`cannot approve run in status ${run.status}`);
    }

    const decision = evaluateToolPolicy(TOOL_PUBLISH_DRAFTS, run.scope);
    await this.audit({
      kind: "approval.granted",
      summary: `Human approved publish_drafts for ${runId}`,
      data: { runId, actorId, decision },
      policyDecisionId: decision.id,
      outcome: "success",
    });

    let published: string[] = run.publishedPaths ?? [];
    if (this.deps.workspace) {
      published = await this.deps.workspace.publishDrafts(run.runId);
    }

    run.publishedPaths = published;
    run.approval = {
      outcome: "approved",
      actorId,
      at: nowIso(),
      policyDecisionId: run.pendingApproval?.policyDecisionId ?? decision.id,
    };
    run.pendingApproval = undefined;
    this.pushStep(run, {
      type: "approval",
      summary: `approved publish to staging (${published.length} files)`,
      toolId: TOOL_PUBLISH_DRAFTS,
      outputSummary: JSON.stringify(published).slice(0, 800),
      status: "ok",
    });
    run.status = "succeeded";
    run.updatedAt = nowIso();
    if (!run.resultSummary) {
      run.resultSummary = `Approved. Published ${published.length} file(s) to staging (vault unchanged).`;
    }
    await this.persistRun(run);
    return run;
  }

  async reject(runId: string, actorId: string): Promise<RunState> {
    const run = await this.loadRun(runId);
    if (run.approval?.outcome === "rejected" && run.status === "cancelled") {
      return run;
    }
    if (run.status !== "waiting") {
      throw new Error(`cannot reject run in status ${run.status}`);
    }
    run.approval = {
      outcome: "rejected",
      actorId,
      at: nowIso(),
      policyDecisionId: run.pendingApproval?.policyDecisionId,
    };
    run.pendingApproval = undefined;
    run.status = "cancelled";
    run.updatedAt = nowIso();
    this.pushStep(run, {
      type: "approval",
      summary: "rejected — drafts kept, staging unchanged",
      status: "ok",
    });
    await this.audit({
      kind: "approval.rejected",
      summary: `Human rejected publish_drafts for ${runId}`,
      data: { runId, actorId },
      outcome: "cancelled",
    });
    await this.persistRun(run);
    return run;
  }

  private async executeProposed(
    run: RunState,
    parent: AgentSpec,
    proposed: ProposedToolCall[]
  ): Promise<void> {
    for (const call of proposed.slice(0, MAX_PLAN_TOOLS)) {
      if (call.tool === "spawn_subagent") {
        const childId = String(call.args.agentId ?? "workspace-scout");
        const goal = String(call.args.goal ?? run.goal);
        if (!parent.subAgentsAllowlist?.includes(childId) || !graphIncludes(this.graph, childId)) {
          this.pushStep(run, {
            type: "subagent",
            summary: `skipped spawn ${childId}: not allowlisted`,
            agentId: childId,
            status: "error",
          });
          continue;
        }
        await this.runSubAgent(run, childId, goal);
        continue;
      }
      const signal = await this.runTool(run, parent, call.tool, call.args);
      if (signal === "pause") return;
    }
  }

  private async executeFallback(run: RunState, parent: AgentSpec): Promise<void> {
    if (parent.toolsAllowlist.includes("search_memory") && this.deps.memory) {
      await this.runTool(run, parent, "search_memory", {
        query: run.goal,
        limit: 5,
      });
    }
    if (
      parent.subAgentsAllowlist?.includes("workspace-scout") &&
      graphIncludes(this.graph, "workspace-scout") &&
      this.deps.workspace
    ) {
      await this.runSubAgent(run, "workspace-scout", `Scout workspace for: ${run.goal}`);
    }
  }

  private async requestPublishApproval(run: RunState, draftPaths: string[]): Promise<void> {
    const decision = evaluateToolPolicy(TOOL_PUBLISH_DRAFTS, run.scope);
    run.pendingApproval = {
      policyDecisionId: decision.id,
      action: TOOL_PUBLISH_DRAFTS,
      draftPaths,
    };
    run.status = "waiting";
    run.updatedAt = nowIso();
    this.pushStep(run, {
      type: "approval",
      summary: `waiting: publish ${draftPaths.length} draft(s) to staging`,
      toolId: TOOL_PUBLISH_DRAFTS,
      outputSummary: JSON.stringify(draftPaths).slice(0, 800),
      status: "pending",
    });
    await this.audit({
      kind: "approval.requested",
      summary: `Publish of ${draftPaths.length} draft(s) requires approval`,
      data: { runId: run.runId, draftPaths, decision },
      policyDecisionId: decision.id,
      outcome: "pending_approval",
    });
  }

  private async synthesize(run: RunState, purpose: string): Promise<string> {
    return this.deps.provider!.complete([
      {
        role: "system",
        content: `Summarize operator run results for the human (${purpose}).`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            goal: run.goal,
            status: run.status,
            pendingApproval: run.pendingApproval,
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

    if (this.deps.workspace && child.toolsAllowlist.includes("list_workspace")) {
      const mounts = this.deps.workspace.listMounts();
      const mount = mounts.find((m) => m.id === "vault") ?? mounts[0];
      if (mount) {
        const listing = await this.deps.workspace.list(mount.id, "");
        handoff.result = {
          mountId: mount.id,
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
  ): Promise<"continue" | "pause"> {
    if (!agent.toolsAllowlist.includes(toolId)) {
      this.pushStep(run, {
        type: "tool",
        summary: `skipped ${toolId}: not allowlisted`,
        toolId,
        status: "error",
      });
      return "continue";
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
        type: "tool",
        summary: `denied ${toolId}: ${decision.reason}`,
        toolId,
        status: "error",
      });
      return "continue";
    }

    if (decision.outcome !== "allow") {
      this.pushStep(run, {
        type: "approval",
        summary: `blocked ${toolId}: ${decision.reason}`,
        toolId,
        status: "pending",
      });
      run.pendingApproval = {
        policyDecisionId: decision.id,
        action: toolId,
        draftPaths: this.deps.workspace
          ? await this.deps.workspace.listDrafts(run.runId)
          : [],
      };
      run.status = "waiting";
      run.updatedAt = nowIso();
      return "pause";
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
    } else if (toolId === TOOL_DRAFT_WRITE && this.deps.workspace) {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!path || !content) {
        this.pushStep(run, {
          type: "tool",
          summary: "draft_write missing path or content",
          toolId,
          status: "error",
        });
        return "continue";
      }
      if (this.deps.dryRun) {
        output = JSON.stringify({ dryRun: true, path, bytes: content.length });
      } else {
        const written = await this.deps.workspace.draftWrite(run.runId, path, content);
        output = JSON.stringify({ ...written, mountId: "drafts" });
      }
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
    return "continue";
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
    if (this.deps.dryRun) return;
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
