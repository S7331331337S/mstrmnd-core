import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const config = JSON.parse(await readFile(new URL("../doctrine.config.json", import.meta.url), "utf8"));
const token = process.env.GITHUB_TOKEN;
const headers = { Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" };
if (token) headers.Authorization = `Bearer ${token}`;

if (!/^[0-9a-f]{40}$/i.test(config.ref)) {
  throw new Error("doctrine.config.json ref must be a pinned 40-character commit SHA");
}

const root = new URL("../", import.meta.url);
const outputDir = join(root.pathname, config.outputDirectory);
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const hashes = {};
for (const path of config.requiredFiles) {
  const url = `https://api.github.com/repos/${config.repository}/contents/${path}?ref=${config.ref}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  const content = await response.text();
  const destination = join(outputDir, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
  hashes[path] = createHash("sha256").update(content).digest("hex");
}

const manifest = {
  schemaVersion: 1,
  repository: config.repository,
  ref: config.ref,
  commit: config.ref,
  requiredFiles: config.requiredFiles,
  hashes,
  loadedAt: new Date().toISOString()
};
await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Synced ${config.requiredFiles.length} doctrine files from ${config.repository}@${config.ref}`);
