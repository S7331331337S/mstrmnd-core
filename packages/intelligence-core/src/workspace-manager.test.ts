import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorkspaceManager } from "./workspace-manager";

async function freshWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-workspace-"));
  const vault = path.join(root, "vault");
  return {
    vault,
    manager: new WorkspaceManager(WorkspaceManager.defaultConfig(vault)),
  };
}

test("allows paths inside the workspace root", async () => {
  const { vault, manager } = await freshWorkspace();
  assert.ok(manager.isAllowed(path.join(vault, "note.md")));
  assert.ok(manager.isAllowed(path.join(vault, "sub", "deep", "note.md")));
});

test("resolves relative paths against the workspace root, not the cwd", async () => {
  const { manager } = await freshWorkspace();
  assert.ok(manager.isAllowed("note.md"));
});

test("rejects siblings that merely share a textual prefix", async () => {
  const { vault, manager } = await freshWorkspace();
  // Regression: a bare `startsWith` on the raw prefix accepted these, letting
  // an agent write outside the approved workspace.
  assert.equal(manager.isAllowed(`${vault}-backup/note.md`), false);
  assert.equal(manager.isAllowed(`${vault}x/note.md`), false);
});

test("rejects traversal back out of the workspace root", async () => {
  const { vault, manager } = await freshWorkspace();
  assert.equal(
    manager.isAllowed(path.join(vault, "..", "vault-backup", "note.md")),
    false
  );
  assert.equal(manager.isAllowed("../vault-backup/note.md"), false);
});

test("rejects extensions outside the allow-list", async () => {
  const { vault, manager } = await freshWorkspace();
  assert.equal(manager.isAllowed(path.join(vault, "secrets.env")), false);
});

test("write refuses a prefix-sibling path and reports the violation", async () => {
  const { vault, manager } = await freshWorkspace();
  const result = await manager.write(`${vault}-backup/note.md`, "should not land");
  assert.equal(result.written, false);
  assert.match(String(result.policyViolation), /outside all allowed prefixes/);
});

test("write persists a path inside the workspace", async () => {
  const { vault, manager } = await freshWorkspace();
  const result = await manager.write("note.md", "ok");
  assert.equal(result.written, true);
  assert.equal(result.path, path.join(vault, "note.md"));
});
