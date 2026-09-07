import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentSpec, ContextPack } from "@mstrmnd/schemas";
import {
  EchoProvider,
  type ModelMessage,
  type ModelProvider,
} from "./model-provider";
import {
  Orchestrator,
  OPERATOR_AGENT,
  WORKSPACE_SCOUT,
  parseProposedTools,
  resolveSpawnSubagentId,
  spawnSubagentPlanHint,
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

class CapturingProvider implements ModelProvider {
  readonly id = "capturing";
  readonly messages: ModelMessage[][] = [];
  constructor(private readonly replies: string[]) {}
  async complete(messages: ModelMessage[]): Promise<string> {
    this.messages.push(messages);
    return this.replies.shift() ?? "[]";
  }
}

function parentWithAllowlist(ids: string[]): AgentSpec {
  return { ...OPERATOR_AGENT, subAgentsAllowlist: ids };
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

test("resolveSpawnSubagentId prefers explicit aliases then sole allowlisted scout", () => {
  const parent = parentWithAllowlist(["workspace-scout"]);
  assert.deepEqual(
    resolveSpawnSubagentId({ agentId: "workspace-scout" }, parent),
    { agentId: "workspace-scout" }
  );
  assert.deepEqual(
    resolveSpawnSubagentId({ id: "workspace-scout" }, parent),
    { agentId: "workspace-scout" }
  );
  assert.deepEqual(
    resolveSpawnSubagentId({ agent: "workspace-scout" }, parent),
    { agentId: "workspace-scout" }
  );
  assert.deepEqual(
    resolveSpawnSubagentId({ name: "workspace-scout" }, parent),
    { agentId: "workspace-scout" }
  );
  assert.deepEqual(
    resolveSpawnSubagentId({ subagent: "workspace-scout" }, parent),
    { agentId: "workspace-scout" }
  );
  assert.deepEqual(
    resolveSpawnSubagentId({ subAgentId: "workspace-scout" }, parent),
    { agentId: "workspace-scout" }
  );
  assert.deepEqual(resolveSpawnSubagentId({}, parent), {
    agentId: "workspace-scout",
  });
  assert.deepEqual(
    resolveSpawnSubagentId({ agentId: "  workspace-scout  " }, parent),
    { agentId: "workspace-scout" }
  );
});

test("resolveSpawnSubagentId denies missing agentId when zero or multiple options", () => {
  const none = parentWithAllowlist([]);
  const ghost = parentWithAllowlist(["not-a-real-agent"]);
  const many = parentWithAllowlist(["workspace-scout", OPERATOR_AGENT.id]);
  const missingNone = resolveSpawnSubagentId({}, none);
  const missingGhost = resolveSpawnSubagentId({}, ghost);
  const missingMany = resolveSpawnSubagentId({}, many);
  assert.ok("deny" in missingNone);
  assert.match(missingNone.deny, /missing agentId/);
  assert.ok("deny" in missingGhost);
  assert.match(missingGhost.deny, /missing agentId/);
  assert.ok("deny" in missingMany);
  assert.match(missingMany.deny, /ambiguous/);
  assert.deepEqual(
    resolveSpawnSubagentId(
      { name: "campaign-intel" },
      parentWithAllowlist(["workspace-scout"])
    ),
    { agentId: "campaign-intel" },
    "explicit alias still wins even when not allowlisted"
  );
});

test("spawnSubagentPlanHint names the required agentId", () => {
  assert.match(
    spawnSubagentPlanHint(OPERATOR_AGENT),
    /args\.agentId.*workspace-scout/
  );
});

test("spawn_subagent defaults to workspace-scout when agentId is omitted", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-spawn-default-"));
  const vault = path.join(root, "vault");
  await mkdir(vault, { recursive: true });
  const workspace = new WorkspaceService();
  workspace.registerVaultMount(vault);
  const orch = new Orchestrator({
    context: fixtureContext(),
    workspace,
    provider: new ScriptedProvider([
      `[{"tool":"spawn_subagent","args":{}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  assert.ok(finished.steps.some((s) => s.summary === "spawn workspace-scout"));
  assert.equal(finished.handoffs?.[0]?.childAgentId, WORKSPACE_SCOUT.id);
});

test("spawn_subagent accepts alias keys for the child id", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-spawn-alias-"));
  const vault = path.join(root, "vault");
  await mkdir(vault, { recursive: true });
  const workspace = new WorkspaceService();
  workspace.registerVaultMount(vault);
  const orch = new Orchestrator({
    context: fixtureContext(),
    workspace,
    provider: new ScriptedProvider([
      `[{"tool":"spawn_subagent","args":{"agent":"workspace-scout"}},{"tool":"spawn_subagent","args":{"name":"workspace-scout"}},{"tool":"spawn_subagent","args":{"subagent":"workspace-scout"}}]`,
      "synthesis",
    ]),
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  const spawns = finished.steps.filter((s) => s.summary === "spawn workspace-scout");
  assert.equal(spawns.length, 3);
});

test("parent plan prompt tells the model spawn_subagent needs agentId", async () => {
  const provider = new CapturingProvider([
    `[{"tool":"get_context","args":{}}]`,
    "synthesis",
  ]);
  const orch = new Orchestrator({
    context: fixtureContext(),
    provider,
    dryRun: true,
    boundary: testBoundary(),
  });
  const run = orch.createRun(OPERATOR_AGENT.id, "goal");
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  const planMessages = provider.messages[0] ?? [];
  const joined = planMessages.map((m) => m.content).join("\n");
  assert.match(joined, /spawn_subagent requires args\.agentId/);
  assert.match(joined, /workspace-scout/);
});

test("explicit unregistered agentId still denies after alias resolution", async () => {
  const orch = new Orchestrator({
    context: fixtureContext(),
    provider: new ScriptedProvider([
      `[{"tool":"spawn_subagent","args":{"agent":"campaign-intel"}}]`,
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
  assert.equal(
    finished.steps.some((s) => s.summary === "spawn workspace-scout"),
    false,
    "must not fall back to the scout when an explicit id is present"
  );
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
