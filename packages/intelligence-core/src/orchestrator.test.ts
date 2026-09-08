import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContextPack } from "@mstrmnd/schemas";
import { MemoryEngine } from "./memory-engine";
import type { ModelProvider } from "./model-provider";
import { EchoProvider } from "./model-provider";
import { EMPTY_IDENTITY } from "./identity-loader";
import { localProvenance, OPERATOR_ZERO_SCOPE } from "./operator-scope";
import { Orchestrator } from "./orchestrator";
import { WorkspaceService } from "./workspace-service";

class ScriptedProvider implements ModelProvider {
  readonly id = "scripted";
  constructor(private replies: string[]) {}
  async complete(): Promise<string> {
    return this.replies.shift() ?? "done";
  }
}

function fixtureContext(): ContextPack {
  const scope = { ...OPERATOR_ZERO_SCOPE };
  const provenance = localProvenance("test");
  return {
    scope,
    doctrineRef: "test-pin",
    operator: {
      id: "local-operator",
      displayName: "Test Operator",
      scope,
      provenance,
    },
    company: { id: "mstrmnd", name: "MSTRMND", scope, provenance },
    business: {
      goals: [],
      constraints: [],
      activeProjects: [],
      activeClients: [],
      scope,
      provenance,
    },
    identity: { ...EMPTY_IDENTITY },
    memoryHits: [],
    workspaceRoots: [],
    assembledAt: new Date().toISOString(),
  };
}

describe("Orchestrator", () => {
  const temps: string[] = [];

  after(async () => {
    await Promise.all(temps.map((d) => rm(d, { recursive: true, force: true })));
  });

  async function setup(provider: ModelProvider) {
    const root = await mkdtemp(join(tmpdir(), "mstrmnd-orch-"));
    temps.push(root);
    const vault = join(root, "vault");
    await mkdir(vault);
    await writeFile(join(vault, "keep.md"), "untouched", "utf8");
    const workspace = new WorkspaceService();
    await workspace.registerManagedMounts(root);
    workspace.registerVaultMount(vault);
    const orch = new Orchestrator({
      context: fixtureContext(),
      memory: new MemoryEngine(),
      workspace,
      provider,
      repoRoot: root,
    });
    return { root, vault, workspace, orch };
  }

  it("falls back when the model plan is not JSON (echo)", async () => {
    const { orch } = await setup(new EchoProvider());
    const run = orch.createRun("operator-agent", "Summarize workspace");
    const finished = await orch.dispatch(run);
    assert.equal(finished.status, "succeeded");
    assert.ok(finished.steps.some((s) => s.toolId === "search_memory"));
  });

  it("executes allowlisted tools from a parsed plan", async () => {
    const { orch } = await setup(
      new ScriptedProvider([
        JSON.stringify([{ tool: "get_context", args: {} }]),
        "synthesis",
      ])
    );
    const run = orch.createRun("operator-agent", "context please");
    const finished = await orch.dispatch(run);
    assert.equal(finished.status, "succeeded");
    assert.ok(finished.steps.some((s) => s.toolId === "get_context" && s.status === "ok"));
    assert.ok(finished.steps.some((s) => s.summary === "final synthesis"));
  });

  it("skips tools that are not on the allowlist", async () => {
    const { orch } = await setup(
      new ScriptedProvider([
        JSON.stringify([{ tool: "write_file", args: { path: "x" } }]),
        "synthesis",
      ])
    );
    const run = orch.createRun("operator-agent", "hack the vault");
    const finished = await orch.dispatch(run);
    assert.equal(finished.status, "succeeded");
    const skipped = finished.steps.find((s) => s.toolId === "write_file");
    assert.ok(skipped);
    assert.equal(skipped.status, "error");
  });

  it("draft_write waits for approval; approve publishes staging idempotently", async () => {
    const { orch, vault } = await setup(
      new ScriptedProvider([
        JSON.stringify([
          {
            tool: "draft_write",
            args: { path: "brief.md", content: "operator draft" },
          },
        ]),
        "waiting note",
      ])
    );
    const run = orch.createRun("operator-agent", "draft a brief");
    const waiting = await orch.dispatch(run);
    assert.equal(waiting.status, "waiting");
    assert.deepEqual(waiting.pendingApproval?.draftPaths, ["brief.md"]);
    assert.equal(await readFile(join(vault, "keep.md"), "utf8"), "untouched");

    const approved = await orch.approve(waiting.runId, "local-operator");
    assert.equal(approved.status, "succeeded");
    assert.deepEqual(approved.publishedPaths, ["brief.md"]);
    assert.equal(await readFile(join(vault, "keep.md"), "utf8"), "untouched");

    const again = await orch.approve(waiting.runId, "local-operator");
    assert.equal(again.status, "succeeded");
    assert.deepEqual(again.publishedPaths, ["brief.md"]);
  });

  it("reject cancels without publishing", async () => {
    const { orch, workspace } = await setup(
      new ScriptedProvider([
        JSON.stringify([
          {
            tool: "draft_write",
            args: { path: "nope.md", content: "secret" },
          },
        ]),
        "waiting",
      ])
    );
    const waiting = await orch.dispatch(
      orch.createRun("operator-agent", "draft then reject")
    );
    const rejected = await orch.reject(waiting.runId, "local-operator");
    assert.equal(rejected.status, "cancelled");
    const staged = await workspace.listDrafts(waiting.runId);
    assert.deepEqual(staged, ["nope.md"]);
    await assert.rejects(() => workspace.read("staging", `${waiting.runId}/nope.md`));
    const again = await orch.reject(waiting.runId, "local-operator");
    assert.equal(again.status, "cancelled");
  });
});
