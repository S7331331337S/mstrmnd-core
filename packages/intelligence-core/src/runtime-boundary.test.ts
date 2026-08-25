import assert from "node:assert/strict";
import { test } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRuntime } from "./runtime.ts";
import { resolveRepoRoot } from "./doctrine-loader.ts";
import { MissingBoundaryError } from "./policy-boundary.ts";
import { Orchestrator } from "./orchestrator.ts";
import { assembleContext } from "./context-assembler.ts";
import { MemoryEngine } from "./memory-engine.ts";

test("createRuntime attaches a threat boundary and dispatch records it", async () => {
  const runtime = await createRuntime({
    allowMissingVault: true,
    repoRoot: resolveRepoRoot(),
  });
  assert.ok(runtime.boundary.id);
  assert.equal(runtime.boundary.networkAllowlist.length, 0);
  assert.ok(runtime.boundary.mcpAllowlist.includes("mstrmnd"));

  const orch = runtime.createOrchestrator({ dryRun: true });
  const run = orch.createRun("operator-agent", "Summarize operator context");
  assert.equal(run.boundaryId, runtime.boundary.id);
  const finished = await orch.dispatch(run);
  assert.equal(finished.status, "succeeded");
  assert.equal(finished.boundaryId, runtime.boundary.id);
});

test("Orchestrator construction without a boundary fails closed", async () => {
  const repoRoot = resolveRepoRoot();
  const memory = new MemoryEngine();
  const context = await assembleContext({
    repoRoot,
    memory,
  });
  assert.throws(
    () =>
      new Orchestrator({
        context,
        repoRoot,
        dryRun: true,
        // @ts-expect-error testing runtime fail-closed
        boundary: null,
      }),
    MissingBoundaryError
  );
});

test("intelligence-core does not import the A2A edge adapter", async () => {
  const dir = join(resolveRepoRoot(), "packages/intelligence-core/src");
  const files = await readdir(dir);
  for (const file of files) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const text = await readFile(join(dir, file), "utf8");
    assert.equal(
      text.includes("@mstrmnd/connectors/a2a") || text.includes("connectors/src/a2a"),
      false,
      `${file} must not import A2A`
    );
  }
});
