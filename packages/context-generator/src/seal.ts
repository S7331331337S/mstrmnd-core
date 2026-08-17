import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Compute a SHA-256 checksum over all tracked files in the context directory.
 * The checksum is deterministic given the same file set and contents.
 */
export function computeSeal(contextPath: string, trackedFiles: string[]): string {
  const hash = createHash("sha256");
  for (const rel of [...trackedFiles].sort()) {
    const abs = join(contextPath, rel);
    try {
      const content = readFileSync(abs, "utf-8");
      hash.update(`${rel}:${content}\n`);
    } catch {
      // file missing — still hash the path so removal is detectable
      hash.update(`${rel}:MISSING\n`);
    }
  }
  return hash.digest("hex");
}

/**
 * Verify that the stored seal in .mstrmnd-seal matches the current file state.
 */
export function verifySeal(contextPath: string, trackedFiles: string[]): boolean {
  const sealPath = join(contextPath, ".mstrmnd-seal");
  try {
    const stored = readFileSync(sealPath, "utf-8").trim();
    const current = computeSeal(contextPath, trackedFiles);
    return stored === current;
  } catch {
    return false;
  }
}
