import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspacePathError, WorkspaceService } from "./workspace-service";

describe("WorkspaceService drafts", () => {
  const temps: string[] = [];

  after(async () => {
    await Promise.all(temps.map((d) => rm(d, { recursive: true, force: true })));
  });

  async function setup() {
    const root = await mkdtemp(join(tmpdir(), "mstrmnd-ws-"));
    temps.push(root);
    const vault = join(root, "vault");
    await mkdir(vault);
    await writeFile(join(vault, "secret.md"), "vault-original", "utf8");
    const ws = new WorkspaceService();
    await ws.registerManagedMounts(root);
    ws.registerVaultMount(vault);
    return { root, vault, ws };
  }

  it("writes drafts and denies path escape", async () => {
    const { ws } = await setup();
    const written = await ws.draftWrite("run-1", "notes/hello.md", "# hi");
    assert.equal(written.path, "notes/hello.md");
    const listed = await ws.listDrafts("run-1");
    assert.deepEqual(listed, ["notes/hello.md"]);
    await assert.rejects(
      () => ws.draftWrite("run-1", "../escape.md", "nope"),
      WorkspacePathError
    );
  });

  it("publishes to staging, not the vault, and is idempotent", async () => {
    const { ws, vault } = await setup();
    await ws.draftWrite("run-2", "out.md", "draft-body");
    const first = await ws.publishDrafts("run-2");
    const second = await ws.publishDrafts("run-2");
    assert.deepEqual(first, ["out.md"]);
    assert.deepEqual(second, ["out.md"]);
    const vaultText = await readFile(join(vault, "secret.md"), "utf8");
    assert.equal(vaultText, "vault-original");
    const staged = await ws.read("staging", "run-2/out.md");
    assert.equal(staged.content, "draft-body");
  });

  it("ignores env bypass when writing", async () => {
    const { ws, vault } = await setup();
    process.env.MSTRMND_ALLOW_UNSAFE_WRITES = "1";
    try {
      await ws.draftWrite("run-3", "x.md", "ok");
      const vaultText = await readFile(join(vault, "secret.md"), "utf8");
      assert.equal(vaultText, "vault-original");
    } finally {
      delete process.env.MSTRMND_ALLOW_UNSAFE_WRITES;
    }
  });
});
