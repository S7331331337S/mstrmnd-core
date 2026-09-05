import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorkspaceService } from "./workspace-service";
import {
  denyApprover,
  stageAndMaybePublish,
  type WriteApprover,
} from "./write-approval";

async function freshWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-gate-"));
  const vault = path.join(root, "vault");
  await mkdir(vault, { recursive: true });
  const workspace = new WorkspaceService();
  workspace.registerVaultMount(vault);
  return { vault, workspace };
}

const approveAll: WriteApprover = async () => ({ approved: true });

test("an unapproved write is drafted but never published", async () => {
  const { vault, workspace } = await freshWorkspace();
  const outcome = await stageAndMaybePublish(
    workspace,
    denyApprover,
    "vault",
    "brief.md",
    "# Daily brief"
  );
  assert.equal(outcome.published, false);
  assert.match(outcome.message, /awaiting approval/);
  assert.equal(existsSync(path.join(vault, "brief.md")), false);
  assert.ok(outcome.draft);
  assert.equal(
    await readFile(path.join(vault, outcome.draft.draftPath), "utf8"),
    "# Daily brief"
  );
});

test("an approved write is published to the target", async () => {
  const { vault, workspace } = await freshWorkspace();
  const outcome = await stageAndMaybePublish(
    workspace,
    approveAll,
    "vault",
    "brief.md",
    "# Daily brief"
  );
  assert.equal(outcome.published, true);
  assert.match(outcome.message, /^Published \(approved\)/);
  assert.equal(await readFile(path.join(vault, "brief.md"), "utf8"), "# Daily brief");
});

test("an out-of-policy target is refused without staging or prompting", async () => {
  const { vault, workspace } = await freshWorkspace();
  let asked = 0;
  const counting: WriteApprover = async () => {
    asked += 1;
    return { approved: true };
  };
  const outcome = await stageAndMaybePublish(
    workspace,
    counting,
    "vault",
    "../vault-backup/note.md",
    "should not land"
  );
  assert.equal(outcome.published, false);
  assert.match(outcome.message, /blocked by policy/);
  assert.equal(asked, 0);
  assert.equal(existsSync(path.join(vault, ".mstrmnd")), false);
});

test("dry-run never writes the vault", async () => {
  const { vault, workspace } = await freshWorkspace();
  const outcome = await stageAndMaybePublish(
    workspace,
    approveAll,
    "vault",
    "brief.md",
    "# Daily brief",
    { dryRun: true }
  );
  assert.equal(outcome.published, false);
  assert.match(outcome.message, /dry-run/);
  assert.equal(existsSync(path.join(vault, "brief.md")), false);
  assert.equal(existsSync(path.join(vault, ".mstrmnd")), false);
});

test("denyApprover refuses when no operator is attached", async () => {
  const decision = await denyApprover({
    mountId: "vault",
    targetPath: "brief.md",
    draftPath: ".mstrmnd/drafts/brief.md",
    draftId: "x",
    content: "x",
  });
  assert.equal(decision.approved, false);
  assert.match(String(decision.reason), /no interactive operator/);
});
