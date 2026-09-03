import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  WorkspacePathError,
  WorkspaceService,
  isInsideRoot,
} from "./workspace-service";

async function freshVault() {
  const root = await mkdtemp(path.join(tmpdir(), "mstrmnd-ws-"));
  const vault = path.join(root, "vault");
  await mkdir(vault, { recursive: true });
  await writeFile(path.join(vault, "hello.md"), "hi\n", "utf8");
  const workspace = new WorkspaceService();
  workspace.registerVaultMount(vault);
  return { root, vault, workspace };
}

test("isInsideRoot allows the root and descendants", () => {
  const vault = "/data/vault";
  assert.equal(isInsideRoot(vault, vault), true);
  assert.equal(isInsideRoot("/data/vault/note.md", vault), true);
  assert.equal(isInsideRoot("/data/vault/sub/deep/note.md", vault), true);
});

test("isInsideRoot rejects siblings that share a textual prefix", () => {
  const vault = "/data/vault";
  assert.equal(isInsideRoot("/data/vault-backup/note.md", vault), false);
  assert.equal(isInsideRoot("/data/vaultx/note.md", vault), false);
});

test("resolveSafe allows mount-relative files", async () => {
  const { workspace } = await freshVault();
  const { abs } = workspace.resolveSafe("vault", "hello.md");
  assert.ok(abs.endsWith(`${path.sep}hello.md`));
});

test("resolveSafe denies .. traversal", async () => {
  const { workspace } = await freshVault();
  assert.throws(
    () => workspace.resolveSafe("vault", "../outside.md"),
    WorkspacePathError
  );
  assert.throws(
    () => workspace.resolveSafe("vault", "sub/../../outside.md"),
    WorkspacePathError
  );
});

test("resolveSafe denies sibling-prefix paths after resolve", async () => {
  const { vault, workspace } = await freshVault();
  const sibling = `${vault}-backup/note.md`;
  assert.equal(isInsideRoot(path.resolve(sibling), path.resolve(vault)), false);
});

test("write persists a path inside the mount", async () => {
  const { vault, workspace } = await freshVault();
  const result = await workspace.write("vault", "notes/brief.md", "# ok\n");
  assert.equal(result.path, "notes/brief.md");
  assert.equal(await readFile(path.join(vault, "notes/brief.md"), "utf8"), "# ok\n");
});

test("write refuses a path escape", async () => {
  const { workspace } = await freshVault();
  await assert.rejects(
    () => workspace.write("vault", "../pwned.md", "nope"),
    WorkspacePathError
  );
});

test("stageDraft writes a draft and does not publish the target", async () => {
  const { vault, workspace } = await freshVault();
  const draft = await workspace.stageDraft("vault", "brief.md", "# Daily brief\n");
  assert.ok(draft.id);
  assert.equal(draft.targetPath, "brief.md");
  assert.equal(existsSync(path.join(vault, "brief.md")), false);
  assert.equal(
    await readFile(path.join(vault, draft.draftPath), "utf8"),
    "# Daily brief\n"
  );
});

test("stageDraft refuses an out-of-mount target before creating a draft", async () => {
  const { vault, workspace } = await freshVault();
  await assert.rejects(
    () => workspace.stageDraft("vault", "../vault-backup/note.md", "x"),
    WorkspacePathError
  );
  assert.equal(existsSync(path.join(vault, ".mstrmnd")), false);
});

test("publishDraft writes the target after staging", async () => {
  const { vault, workspace } = await freshVault();
  const draft = await workspace.stageDraft("vault", "brief.md", "# Daily brief\n");
  const published = await workspace.publishDraft(draft.id);
  assert.equal(published.path, "brief.md");
  assert.equal(await readFile(path.join(vault, "brief.md"), "utf8"), "# Daily brief\n");
});
