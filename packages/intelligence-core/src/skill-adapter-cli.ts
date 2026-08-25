#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  benchmarkSkillAdapter,
  compileSkillTargets,
  loadCanonicalSkill,
} from "./skill-adapter.ts";

async function main() {
  const input =
    process.argv.slice(2).find((a) => a !== "--") ??
    "skills/market-intelligence/SKILL.md";
  const abs = resolve(process.cwd(), input);
  const manifest = await loadCanonicalSkill(abs);
  const compiled = compileSkillTargets(manifest);
  const skillDir = dirname(abs);
  for (const item of compiled) {
    if (item.target === "canonical") continue;
    const out = join(skillDir, item.filename);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, item.contents, "utf8");
    console.log(`wrote ${out}`);
  }
  const bench = benchmarkSkillAdapter(manifest);
  console.log(JSON.stringify(bench, null, 2));
  if (!bench.portability) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
