import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

export interface DoctrinePin {
  schemaVersion: string;
  repository: string;
  ref: string | null;
  status: string;
  requiredFiles?: string[];
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function resolveRepoRoot(explicit?: string): string {
  return explicit ?? process.env.MSTRMND_CORE ?? REPO_ROOT;
}

export function doctrinePinPath(repoRoot?: string): string {
  return join(resolveRepoRoot(repoRoot), "doctrine.pin.json");
}

export function doctrineGeneratedRoot(repoRoot?: string): string {
  return join(resolveRepoRoot(repoRoot), ".generated", "mstrmnd-md");
}

export async function loadDoctrinePin(repoRoot?: string): Promise<DoctrinePin | null> {
  const path = doctrinePinPath(repoRoot);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as DoctrinePin;
}

export async function readDoctrineFile(
  relativePath: string,
  repoRoot?: string
): Promise<string | null> {
  const abs = join(doctrineGeneratedRoot(repoRoot), relativePath);
  if (!existsSync(abs)) return null;
  return readFile(abs, "utf8");
}

/** First meaningful paragraph / lines as a short summary. */
export function summarizeMarkdown(md: string, max = 400): string {
  const body = md.replace(/^---[\s\S]*?---\n?/, "").trim();
  const lines = body.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : text.slice(0, max) + "…";
}
