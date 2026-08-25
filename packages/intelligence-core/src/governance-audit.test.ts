import assert from "node:assert/strict";
import { test } from "node:test";
import { OPERATOR_ZERO_SCOPE } from "./operator-scope.ts";
import { operatorZeroBoundary } from "./policy-boundary.ts";
import { buildGovernanceInventory } from "./governance-audit.ts";

test("governance inventory includes containment and MCP exposure", () => {
  const boundary = operatorZeroBoundary({
    toolsAllowlist: ["search_memory"],
    filesystemScope: [{ mountId: "vault", pathPrefix: "" }],
    mcpAllowlist: ["mstrmnd"],
  });
  const graph = buildGovernanceInventory({
    scope: OPERATOR_ZERO_SCOPE,
    boundary,
    human: { id: "local-operator", label: "Operator Zero" },
    agent: {
      id: "operator-agent",
      role: "parent",
      toolsAllowlist: ["search_memory"],
    },
    harnessId: "hermes",
    modelId: "echo",
    mcpServers: [
      { id: "mstrmnd", label: "MSTRMND MCP" },
      { id: "shadow-browser", label: "Unknown browser MCP" },
    ],
    credentials: [{ id: "vault-local", label: "local vault" }],
    dataScopes: [{ id: "operator-zero", label: "operator-zero workspace" }],
  });

  assert.ok(graph.nodes.some((n) => n.kind === "mcp"));
  assert.equal(graph.containment.boundaryId, "operator-zero-default");
  assert.equal(graph.containment.networkDefault, "deny-all");
  const shadow = graph.containment.mcpExposures.find(
    (e) => e.serverId === "shadow-browser"
  );
  assert.equal(shadow?.allowed, false);
  assert.equal(graph.containment.shadowMcpRisk, "medium");
  assert.ok(
    graph.edges.some(
      (e) => e.relation === "authorizes" && e.from.startsWith("human:")
    )
  );
});

test("missing boundary is high shadow-MCP risk", () => {
  const graph = buildGovernanceInventory({
    scope: OPERATOR_ZERO_SCOPE,
    boundary: null,
    human: { id: "x", label: "x" },
    agent: { id: "a", role: "parent", toolsAllowlist: [] },
    harnessId: "cursor",
    modelId: "unknown",
    mcpServers: [{ id: "any", label: "any" }],
    credentials: [],
    dataScopes: [],
  });
  assert.equal(graph.containment.shadowMcpRisk, "high");
  assert.equal(graph.containment.boundaryId, null);
});
