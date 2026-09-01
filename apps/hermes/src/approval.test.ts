import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorkspaceManager } from "@mstrmnd/intelligence-core";
import {
  DRAFT_DIR,
  denyApprover,
  publishWithApproval,
  type Approver,
} from "./approval";

async function freshWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-hermes-"));
  const vault = path.join(root, "vault");
  return {
    vault,
    workspace: new WorkspaceManager(WorkspaceManager.defaultConfig(vault)),
  };
}

const approveAll: Approver = async () => ({ approved: true });

test("an unapproved write is drafted but never published", async () => {
  const { vault, workspace } = await freshWorkspace();

  const outcome = await publishWithApproval(
    workspace,
    denyApprover,
    "brief.md",
    "# Daily brief"
  );

  assert.match(outcome, /awaiting approval/);
  assert.equal(
    existsSync(path.join(vault, "brief.md")),
    false,
    "target must not exist without approval"
  );

  const drafts = await readdir(path.join(vault, DRAFT_DIR));
  assert.equal(drafts.length, 1);
  assert.match(drafts[0]!, /brief\.md$/);
  assert.equal(
    await readFile(path.join(vault, DRAFT_DIR, drafts[0]!), "utf8"),
    "# Daily brief"
  );
});

test("an approved write is published to the target", async () => {
  const { vault, workspace } = await freshWorkspace();

  const outcome = await publishWithApproval(
    workspace,
    approveAll,
    "brief.md",
    "# Daily brief"
  );

  assert.match(outcome, /^Published \(approved\)/);
  assert.equal(await readFile(path.join(vault, "brief.md"), "utf8"), "# Daily brief");
});

test("an out-of-policy target is refused without staging or prompting", async () => {
  const { vault, workspace } = await freshWorkspace();
  let asked = 0;
  const countingApprover: Approver = async () => {
    asked++;
    return { approved: true };
  };

  const outcome = await publishWithApproval(
    workspace,
    countingApprover,
    `${vault}-backup/note.md`,
    "should not land"
  );

  assert.match(outcome, /blocked by policy/);
  assert.equal(asked, 0, "operator must not be prompted for a blocked path");
  assert.equal(existsSync(`${vault}-backup/note.md`), false);
  assert.equal(existsSync(path.join(vault, DRAFT_DIR)), false);
});

test("the default approver refuses when no operator is attached", async () => {
  const decision = await denyApprover({
    targetPath: "/vault/brief.md",
    draftPath: "/vault/.mstrmnd/drafts/brief.md",
    content: "x",
  });
  assert.equal(decision.approved, false);
  assert.match(String(decision.reason), /no interactive operator/);
});
