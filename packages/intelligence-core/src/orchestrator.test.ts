import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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

test("evaluateBoundaryAction denies tools missing from the boundary allow-list", async () => {
  const orch = new Orchestrator({
    context: fixtureContext(),
    provider: new ScriptedProvider([
      `[{"tool":"search_memory","args":{"query":"x"}},{"tool":"get_context","args":{}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: operatorZeroBoundary({
      toolsAllowlist: ["get_context"],
      filesystemScope: [{ mountId: "vault", pathPrefix: "" }],
    }),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  const denied = finished.steps.find((s) => s.toolId === "search_memory");
  assert.equal(denied?.status, "error");
  assert.match(denied?.summary ?? "", /not on the boundary allow-list/);
  assert.ok(finished.steps.some((s) => s.toolId === "get_context"));
});

test("evaluateBoundaryAction denies filesystem paths outside the boundary", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-bound-"));
  const vault = path.join(root, "vault");
  await mkdir(vault, { recursive: true });
  const workspace = new WorkspaceService();
  workspace.registerVaultMount(vault);
  const orch = new Orchestrator({
    context: fixtureContext(),
    workspace,
    provider: new ScriptedProvider([
      `[{"tool":"read_file","args":{"mountId":"vault","path":"00-Inbox/secret.md"}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: operatorZeroBoundary({
      toolsAllowlist: [...OPERATOR_AGENT.toolsAllowlist],
      filesystemScope: [{ mountId: "vault", pathPrefix: "20-Areas" }],
    }),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  const denied = finished.steps.find((s) => s.toolId === "read_file");
  assert.equal(denied?.status, "error");
  assert.match(denied?.summary ?? "", /out of scope|filesystem/);
});

test("workspace-scout list is blocked when the mount is outside filesystemScope", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-scout-"));
  const vault = path.join(root, "vault");
  await mkdir(vault, { recursive: true });
  const workspace = new WorkspaceService();
  workspace.registerVaultMount(vault);
  const orch = new Orchestrator({
    context: fixtureContext(),
    workspace,
    provider: new ScriptedProvider([
      `[{"tool":"spawn_subagent","args":{"agentId":"workspace-scout"}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: operatorZeroBoundary({
      toolsAllowlist: [...OPERATOR_AGENT.toolsAllowlist],
      filesystemScope: [],
    }),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  assert.ok(finished.steps.some((s) => s.summary === "spawn workspace-scout"));
  const blocked = finished.steps.find((s) =>
    (s.summary ?? "").includes("list_workspace")
  );
  assert.equal(blocked?.status, "error");
});

test("write_file stays require-approval and dry-run does not publish", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-write-"));
  const vault = path.join(root, "vault");
  await mkdir(vault, { recursive: true });
  const workspace = new WorkspaceService();
  workspace.registerVaultMount(vault);
  const orch = new Orchestrator({
    context: fixtureContext(),
    workspace,
    provider: new ScriptedProvider([
      `[{"tool":"write_file","args":{"mountId":"vault","path":"note.md","content":"hi"}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  const write = finished.steps.find((s) => s.toolId === "write_file");
  assert.ok(write);
  assert.match(write?.summary ?? "", /dry-run|not staged|not published/i);
  assert.equal(existsSync(path.join(vault, "note.md")), false);
});
