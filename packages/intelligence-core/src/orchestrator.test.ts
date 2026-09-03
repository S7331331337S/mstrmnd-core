import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ContextPack } from "@mstrmnd/schemas";
import { EchoProvider, type ModelProvider } from "./model-provider";
import {
  Orchestrator,
  OPERATOR_AGENT,
  parseProposedTools,
  type OrchestratorDeps,
} from "./orchestrator";
import { WorkspaceService } from "./workspace-service";
import { OPERATOR_ZERO_SCOPE, localProvenance, nowIso } from "./operator-scope";
import {
  MissingBoundaryError,
  operatorZeroBoundary,
} from "./policy-boundary";

function fixtureContext(): ContextPack {
  const scope = OPERATOR_ZERO_SCOPE;
  const provenance = localProvenance("test");
  return {
    scope,
    doctrineRef: "test-doctrine",
    operator: {
      id: "op",
      displayName: "Tester",
      scope,
      provenance,
    },
    company: {
      id: "co",
      name: "MSTRMND",
      scope,
      provenance,
    },
    business: {
      goals: [],
      constraints: [],
      activeProjects: [],
      activeClients: [],
      scope,
      provenance,
    },
    identity: {
      values: [],
      interests: [],
      creativePatterns: [],
      preferences: [],
      scope,
      provenance,
    },
    memoryHits: [],
    workspaceRoots: [],
    assembledAt: nowIso(),
  };
}

class ScriptedProvider implements ModelProvider {
  readonly id = "scripted";
  constructor(private readonly replies: string[]) {}
  async complete(): Promise<string> {
    return this.replies.shift() ?? "[]";
  }
}

function testBoundary() {
  return operatorZeroBoundary({
    toolsAllowlist: [...OPERATOR_AGENT.toolsAllowlist],
    filesystemScope: [{ mountId: "vault", pathPrefix: "" }],
  });
}

test("parseProposedTools reads a JSON array and ignores echo prefix", () => {
  const tools = parseProposedTools(
    `[echo] [{"tool":"get_context","args":{}},{"tool":"search_memory","args":{"query":"x"}}]`
  );
  assert.deepEqual(
    tools.map((t) => t.tool),
    ["get_context", "search_memory"]
  );
});

test("parseProposedTools returns empty for Echo prose without JSON", () => {
  const tools = parseProposedTools(
    "[echo] Goal: hello\nTools: search_memory, list_workspace"
  );
  assert.deepEqual(tools, []);
});

test("EchoProvider dry-run succeeds without a hardcoded tool sequence", async () => {
  const orch = new Orchestrator({
    context: fixtureContext(),
    provider: new EchoProvider(),
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "Summarize operator context");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  assert.equal(
    finished.steps.some((s) => s.summary === "tool search_memory"),
    false,
    "must not hardcode search_memory"
  );
  assert.equal(
    finished.steps.some((s) => s.summary === "spawn workspace-scout"),
    false,
    "must not hardcode workspace-scout"
  );
});

test("parent executes model-proposed allowlisted tools", async () => {
  const orch = new Orchestrator({
    context: fixtureContext(),
    provider: new ScriptedProvider([
      `[{"tool":"get_context","args":{}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  const toolStep = finished.steps.find((s) => s.toolId === "get_context");
  assert.ok(toolStep);
  assert.equal(toolStep?.status, "ok");
});

test("unknown tools become deny steps and do not fail the run", async () => {
  const orch = new Orchestrator({
    context: fixtureContext(),
    provider: new ScriptedProvider([
      `[{"tool":"shell","args":{"cmd":"id"}},{"tool":"get_context","args":{}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  const denied = finished.steps.find((s) => s.toolId === "shell");
  assert.equal(denied?.type, "approval");
  assert.equal(denied?.status, "error");
  assert.match(denied?.summary ?? "", /denied/);
  assert.ok(finished.steps.some((s) => s.toolId === "get_context"));
});

test("unregistered sub-agents are denied; workspace-scout still runs when proposed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-orch-"));
  const vault = path.join(root, "vault");
  await mkdir(vault, { recursive: true });
  const workspace = new WorkspaceService();
  workspace.registerVaultMount(vault);
  const orch = new Orchestrator({
    context: fixtureContext(),
    workspace,
    provider: new ScriptedProvider([
      `[{"tool":"spawn_subagent","args":{"agentId":"campaign-intel"}},{"tool":"spawn_subagent","args":{"agentId":"workspace-scout"}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  const denied = finished.steps.find((s) =>
    (s.summary ?? "").includes("campaign-intel")
  );
  assert.equal(denied?.status, "error");
  assert.ok(finished.steps.some((s) => s.summary === "spawn workspace-scout"));
});

test("constructor and createRun refuse a missing threat boundary", () => {
  assert.throws(
    () =>
      new Orchestrator({
        context: fixtureContext(),
        dryRun: true,
        boundary: undefined as unknown as OrchestratorDeps["boundary"],
      }),
    MissingBoundaryError
  );
});

test("createRun stamps boundaryId from the attached ThreatBoundary", () => {
  const orch = new Orchestrator({
    context: fixtureContext(),
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  assert.equal(run.boundaryId, "operator-zero-default");
  assert.equal(orch.getBoundary().id, "operator-zero-default");
});
