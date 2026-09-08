import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OPERATOR_ZERO_SCOPE } from "./operator-scope";
import {
  evaluateToolPolicy,
  TOOL_DRAFT_WRITE,
  TOOL_PUBLISH_DRAFTS,
} from "./policy";

describe("evaluateToolPolicy", () => {
  const scope = OPERATOR_ZERO_SCOPE;

  it("allows draft_write", () => {
    const d = evaluateToolPolicy(TOOL_DRAFT_WRITE, scope);
    assert.equal(d.outcome, "allow");
  });

  it("requires approval for publish_drafts", () => {
    const d = evaluateToolPolicy(TOOL_PUBLISH_DRAFTS, scope);
    assert.equal(d.outcome, "require-approval");
  });

  it("denies direct write tools", () => {
    assert.equal(evaluateToolPolicy("write_file", scope).outcome, "deny");
    assert.equal(evaluateToolPolicy("delete_file", scope).outcome, "deny");
  });

  it("allows read tools", () => {
    assert.equal(evaluateToolPolicy("search_memory", scope).outcome, "allow");
    assert.equal(evaluateToolPolicy("read_file", scope).outcome, "allow");
  });

  it("does not honor env bypass variables", () => {
    const prev = process.env.MSTRMND_ALLOW_UNSAFE_WRITES;
    process.env.MSTRMND_ALLOW_UNSAFE_WRITES = "1";
    process.env.MSTRMND_SKIP_APPROVAL = "true";
    try {
      assert.equal(evaluateToolPolicy("write_file", scope).outcome, "deny");
      assert.equal(
        evaluateToolPolicy(TOOL_PUBLISH_DRAFTS, scope).outcome,
        "require-approval"
      );
    } finally {
      if (prev === undefined) delete process.env.MSTRMND_ALLOW_UNSAFE_WRITES;
      else process.env.MSTRMND_ALLOW_UNSAFE_WRITES = prev;
      delete process.env.MSTRMND_SKIP_APPROVAL;
    }
  });
});
