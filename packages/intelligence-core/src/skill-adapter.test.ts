import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  benchmarkSkillAdapter,
  compileSkill,
  parseSkillMarkdown,
} from "./skill-adapter.ts";
import { resolveRepoRoot } from "./doctrine-loader.ts";

test("Market Intelligence skill compiles to Claude and AI SDK with one checksum", async () => {
  const root = resolveRepoRoot();
  const markdown = await readFile(
    join(root, "skills/market-intelligence/SKILL.md"),
    "utf8"
  );
  const manifest = parseSkillMarkdown(markdown, "market-intelligence");
  assert.equal(manifest.id, "market-intelligence");
  assert.ok(manifest.activation.includes("operator market brief"));
  assert.match(manifest.body, /own context, policy, identity/i);

  const claude = compileSkill(manifest, "claude");
  const aiSdk = compileSkill(manifest, "ai-sdk");
  assert.match(claude.contents, /^---\nname: market-intelligence/m);
  assert.equal(
    (claude.contents.match(/^# Market Intelligence$/gm) ?? []).length,
    1
  );
  assert.match(aiSdk.contents, /export const skill =/);
  assert.equal(claude.checksum, aiSdk.checksum);

  const bench = benchmarkSkillAdapter(manifest);
  assert.equal(bench.portability, true);
  assert.equal(bench.behavioralConsistency, true);
  assert.equal(bench.activationPreserved, true);
  assert.deepEqual(bench.targets, ["canonical", "claude", "ai-sdk"]);
});
