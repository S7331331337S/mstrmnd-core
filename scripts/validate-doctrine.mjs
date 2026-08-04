import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const config = JSON.parse(await readFile(join(root, "doctrine.config.json"), "utf8"));
const outputDir = join(root, config.outputDirectory);
const manifest = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));

if (!/^[0-9a-f]{40}$/i.test(config.ref)) throw new Error("Doctrine ref must be a pinned commit SHA");
if (manifest.repository !== config.repository || manifest.commit !== config.ref) {
  throw new Error("Doctrine manifest source does not match doctrine.config.json");
}

for (const path of config.requiredFiles) {
  const file = join(outputDir, path);
  await access(file);
  const content = await readFile(file);
  const hash = createHash("sha256").update(content).digest("hex");
  if (manifest.hashes[path] !== hash) throw new Error(`Doctrine hash mismatch: ${path}`);
}

console.log(`Validated ${config.requiredFiles.length} doctrine files at ${manifest.commit}`);
