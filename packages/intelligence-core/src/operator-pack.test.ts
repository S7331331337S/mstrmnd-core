import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONSEQUENTIAL_ACTIONS, type ThreatBoundary } from "@mstrmnd/schemas";
import {
  loadOperatorPackBoundary,
  operatorPackBoundaryPath,
  resolveOperatorPackDir,
  OPERATOR_PACK_BOUNDARY_FILE,
} from "./operator-pack";
import { MissingBoundaryError } from "./policy-boundary";
import { createRuntime } from "./runtime";
import { OPERATOR_ZERO_SCOPE } from "./operator-scope";

const REPO = join(import.meta.dirname, "../../..");

function validBoundary(overrides: Partial<ThreatBoundary> = {}): Record<string, unknown> {
  return {
    id: "pack-test",
    workflowId: "pack-test-flow",
    networkAllowlist: [],
    credentialAllowlist: [],
    toolsAllowlist: ["get_context", "search_memory"],
    filesystemScope: [{ mountId: "vault", pathPrefix: "" }],
    costCeilingUsd: 2,
    consequentialApprovals: [...CONSEQUENTIAL_ACTIONS],
    mcpAllowlist: ["mstrmnd"],
    ...overrides,
  };
}

async function packDir(boundary?: unknown, raw?: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "mstrmnd-pack-"));
  if (raw !== undefined) {
    await writeFile(operatorPackBoundaryPath(dir), raw, "utf8");
  } else if (boundary !== undefined) {
    await writeFile(
      operatorPackBoundaryPath(dir),
      JSON.stringify(boundary, null, 2),
      "utf8"
    );
  }
  return dir;
}

async function withEnv<T>(
  name: string,
  value: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const prev = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env[name];
    else process.env[name] = prev;
  }
}

test("absent boundary.json yields null so the default boundary applies", async () => {
  const dir = await packDir();
  assert.equal(await loadOperatorPackBoundary(dir), null);
});

test("valid boundary.json loads, allows model.complete, and inherits scope", async () => {
  const dir = await packDir(validBoundary());
  const loaded = await loadOperatorPackBoundary(dir, { scope: OPERATOR_ZERO_SCOPE });
  assert.ok(loaded);
  assert.equal(loaded.id, "pack-test");
  assert.ok(loaded.toolsAllowlist.includes("model.complete"));
  assert.ok(loaded.toolsAllowlist.includes("get_context"));
  assert.deepEqual(loaded.scope, OPERATOR_ZERO_SCOPE);
});

test("pack scope wins over the runtime scope when declared", async () => {
  const scope = { organizationId: "acme", workspaceId: "ops", userId: "jane" };
  const dir = await packDir(validBoundary({ scope }));
  const loaded = await loadOperatorPackBoundary(dir, { scope: OPERATOR_ZERO_SCOPE });
  assert.deepEqual(loaded?.scope, scope);
});

test("malformed JSON fails closed", async () => {
  const dir = await packDir(undefined, "{ not json");
  await assert.rejects(loadOperatorPackBoundary(dir), MissingBoundaryError);
});

test("non-object JSON fails closed", async () => {
  const dir = await packDir([1, 2, 3]);
  await assert.rejects(loadOperatorPackBoundary(dir), MissingBoundaryError);
});

test("unknown keys fail closed (typos must not silently widen or drop limits)", async () => {
  const dir = await packDir({ ...validBoundary(), networkAllowList: ["api.example.com"] });
  await assert.rejects(loadOperatorPackBoundary(dir), /unknown keys: networkAllowList/);
});

test("non-string allow-list entries fail closed", async () => {
  const dir = await packDir(validBoundary({ toolsAllowlist: ["get_context", 42] as unknown as string[] }));
  await assert.rejects(loadOperatorPackBoundary(dir), /toolsAllowlist must be an array of strings/);
});

test("malformed filesystemScope entries fail closed", async () => {
  const dir = await packDir({
    ...validBoundary(),
    filesystemScope: [{ mountId: "vault" }],
  });
  await assert.rejects(loadOperatorPackBoundary(dir), /filesystemScope/);
});

test("unknown consequential approvals fail closed", async () => {
  const dir = await packDir({
    ...validBoundary(),
    consequentialApprovals: ["content.publish", "content.publsh"],
  });
  await assert.rejects(loadOperatorPackBoundary(dir), /unknown consequentialApprovals: content.publsh/);
});

test("structural checks from assertBoundary still apply", async () => {
  const dir = await packDir(validBoundary({ costCeilingUsd: -1 }));
  await assert.rejects(loadOperatorPackBoundary(dir), MissingBoundaryError);
  const noId = await packDir(validBoundary({ id: "" }));
  await assert.rejects(loadOperatorPackBoundary(noId), MissingBoundaryError);
});

test("$schema is tolerated and stripped", async () => {
  const dir = await packDir({ $schema: "https://example.com/boundary.json", ...validBoundary() });
  const loaded = await loadOperatorPackBoundary(dir);
  assert.ok(loaded);
  assert.equal("$schema" in loaded, false);
});

test("the shipped operator-pack template boundary is valid", async () => {
  const loaded = await loadOperatorPackBoundary(join(REPO, "templates", "operator-pack"));
  assert.ok(loaded, `templates/operator-pack/${OPERATOR_PACK_BOUNDARY_FILE} must exist`);
  assert.equal(loaded.id, "example-operator");
  assert.deepEqual(loaded.networkAllowlist, []);
  assert.ok(loaded.toolsAllowlist.includes("write_file"));
  assert.deepEqual([...loaded.consequentialApprovals].sort(), [...CONSEQUENTIAL_ACTIONS].sort());
});

test("resolveOperatorPackDir prefers explicit, then env, then fallback", async () => {
  await withEnv("MSTRMND_OPERATOR_PACK", "/env/pack", async () => {
    assert.equal(resolveOperatorPackDir("/explicit", "/vault"), "/explicit");
    assert.equal(resolveOperatorPackDir(undefined, "/vault"), "/env/pack");
    assert.equal(resolveOperatorPackDir("  ", "/vault"), "/env/pack");
  });
  await withEnv("MSTRMND_OPERATOR_PACK", undefined, async () => {
    assert.equal(resolveOperatorPackDir(undefined, "/vault"), "/vault");
    assert.equal(resolveOperatorPackDir(undefined, undefined), undefined);
  });
});

test("createRuntime uses the pack boundary when the vault is an operator pack", async () => {
  const vault = await packDir(validBoundary({ id: "vault-pack" }));
  await withEnv("MSTRMND_OPERATOR_PACK", undefined, async () => {
    const runtime = await createRuntime({ repoRoot: REPO, vaultPath: vault });
    assert.equal(runtime.boundarySource, "pack");
    assert.equal(runtime.boundary.id, "vault-pack");
    const orch = runtime.createOrchestrator({ dryRun: true });
    assert.equal(orch.getBoundary().id, "vault-pack");
    const run = await orch.dispatch(orch.createRun("operator-agent", "pack smoke"));
    assert.equal(run.status, "succeeded");
    assert.equal(run.boundaryId, "vault-pack");
  });
});

test("createRuntime honours MSTRMND_OPERATOR_PACK separately from the vault", async () => {
  const vault = await mkdtemp(join(tmpdir(), "mstrmnd-vault-"));
  await mkdir(join(vault, "notes"), { recursive: true });
  const pack = await packDir(validBoundary({ id: "env-pack" }));
  await withEnv("MSTRMND_OPERATOR_PACK", pack, async () => {
    const runtime = await createRuntime({ repoRoot: REPO, vaultPath: vault });
    assert.equal(runtime.boundarySource, "pack");
    assert.equal(runtime.boundary.id, "env-pack");
  });
});

test("createRuntime falls back to the Operator Zero default without a pack file", async () => {
  const vault = await mkdtemp(join(tmpdir(), "mstrmnd-vault-"));
  await withEnv("MSTRMND_OPERATOR_PACK", undefined, async () => {
    const runtime = await createRuntime({ repoRoot: REPO, vaultPath: vault });
    assert.equal(runtime.boundarySource, "default");
    assert.equal(runtime.boundary.id, "operator-zero-default");
    assert.deepEqual(runtime.boundary.networkAllowlist, []);
  });
});

test("explicit RuntimeConfig.boundary wins over the pack file", async () => {
  const vault = await packDir(validBoundary({ id: "vault-pack" }));
  const explicit = { ...(validBoundary({ id: "explicit" }) as unknown as ThreatBoundary) };
  await withEnv("MSTRMND_OPERATOR_PACK", undefined, async () => {
    const runtime = await createRuntime({ repoRoot: REPO, vaultPath: vault, boundary: explicit });
    assert.equal(runtime.boundarySource, "config");
    assert.equal(runtime.boundary.id, "explicit");
  });
});

test("createRuntime refuses to boot on an invalid pack boundary", async () => {
  const vault = await packDir(undefined, '{"id":"broken"}');
  await withEnv("MSTRMND_OPERATOR_PACK", undefined, async () => {
    await assert.rejects(
      createRuntime({ repoRoot: REPO, vaultPath: vault }),
      MissingBoundaryError
    );
  });
});
