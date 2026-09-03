import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSEQUENTIAL_ACTIONS } from "@mstrmnd/schemas";
import {
  assertBoundary,
  evaluateBoundaryAction,
  MissingBoundaryError,
  operatorZeroBoundary,
} from "./policy-boundary";

const base = operatorZeroBoundary({
  toolsAllowlist: ["search_memory", "read_file", "write_file", "web_fetch"],
  filesystemScope: [{ mountId: "vault", pathPrefix: "20-Areas" }],
  mcpAllowlist: ["mstrmnd"],
});

test("assertBoundary refuses missing or incomplete boundaries", () => {
  assert.throws(() => assertBoundary(null), MissingBoundaryError);
  assert.throws(
    () => assertBoundary({ ...base, id: "" }),
    MissingBoundaryError
  );
  assert.throws(
    () =>
      assertBoundary({
        ...base,
        costCeilingUsd: -1,
      }),
    MissingBoundaryError
  );
});

test("default Operator Zero boundary is deny-all egress and no extra credentials", () => {
  assert.equal(base.networkAllowlist.length, 0);
  assert.equal(base.credentialAllowlist.length, 0);
  assert.deepEqual(base.consequentialApprovals, [...CONSEQUENTIAL_ACTIONS]);
});

test("allows an in-scope read tool", () => {
  const decision = evaluateBoundaryAction(base, {
    toolId: "search_memory",
  });
  assert.equal(decision.outcome, "allow");
});

test("denies tools, network, credentials, filesystem, cost, and shadow MCP", () => {
  assert.equal(
    evaluateBoundaryAction(base, { toolId: "shell" }).outcome,
    "deny"
  );
  assert.equal(
    evaluateBoundaryAction(base, {
      toolId: "web_fetch",
      networkDestinations: ["evil.example"],
    }).ruleIds?.includes("network-denied"),
    true
  );
  assert.equal(
    evaluateBoundaryAction(base, {
      toolId: "search_memory",
      credentialIds: ["prod-aws"],
    }).ruleIds?.includes("credential-denied"),
    true
  );
  assert.equal(
    evaluateBoundaryAction(base, {
      toolId: "read_file",
      filesystem: { mountId: "vault", path: "00-Inbox/secret.md" },
    }).ruleIds?.includes("filesystem-denied"),
    true
  );
  assert.equal(
    evaluateBoundaryAction(base, {
      toolId: "read_file",
      filesystem: { mountId: "vault", path: "20-Areas/Business.md" },
    }).outcome,
    "allow"
  );
  assert.equal(
    evaluateBoundaryAction(base, {
      toolId: "search_memory",
      accruedCostUsd: 0.8,
      estimatedCostUsd: 0.5,
    }).ruleIds?.includes("cost-ceiling"),
    true
  );
  assert.equal(
    evaluateBoundaryAction(base, {
      toolId: "search_memory",
      mcpServerId: "shadow-slack",
    }).ruleIds?.includes("mcp-denied"),
    true
  );
});

test("sibling-prefix filesystem paths are out of scope", () => {
  const decision = evaluateBoundaryAction(base, {
    toolId: "read_file",
    filesystem: { mountId: "vault", path: "20-Areas-backup/secret.md" },
  });
  assert.equal(decision.ruleIds?.includes("filesystem-denied"), true);
});

test("write-like and consequential tools require approval instead of auto-running", () => {
  const write = evaluateBoundaryAction(base, { toolId: "write_file" });
  assert.equal(write.outcome, "require-approval");
  const publish = evaluateBoundaryAction(base, {
    toolId: "content.publish",
    consequential: "content.publish",
  });
  assert.equal(publish.outcome, "deny"); // not on toolsAllowlist
});

test("missing boundary yields deny, not allow", () => {
  const decision = evaluateBoundaryAction(null, { toolId: "search_memory" });
  assert.equal(decision.outcome, "deny");
  assert.equal(decision.ruleIds?.includes("missing-boundary"), true);
});
