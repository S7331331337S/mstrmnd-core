import { test } from "node:test";
import assert from "node:assert/strict";
import { denyApprover, isInteractiveSession } from "./approval";

test("the default approver refuses when no operator is attached", async () => {
  const decision = await denyApprover({
    mountId: "vault",
    targetPath: "brief.md",
    draftPath: ".mstrmnd/drafts/brief.md",
    draftId: "draft-1",
    content: "x",
  });
  assert.equal(decision.approved, false);
  assert.match(String(decision.reason), /no interactive operator/);
});

test("isInteractiveSession is false without a TTY", () => {
  assert.equal(isInteractiveSession({ isTTY: false }, { isTTY: true }), false);
  assert.equal(isInteractiveSession({ isTTY: true }, { isTTY: false }), false);
  assert.equal(isInteractiveSession({ isTTY: true }, { isTTY: true }), true);
});
