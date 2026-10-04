import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RuntimeScope, ThreatBoundary } from "@mstrmnd/schemas";
import { CONSEQUENTIAL_ACTIONS } from "@mstrmnd/schemas";
import { assertBoundary, MissingBoundaryError } from "./policy-boundary";

/** File inside an operator pack that declares the run ThreatBoundary. */
export const OPERATOR_PACK_BOUNDARY_FILE = "boundary.json";

/** Where the active boundary came from. Hosts print this so operators can tell. */
export type BoundarySource = "config" | "pack" | "default";

const BOUNDARY_KEYS = new Set<string>([
  "$schema",
  "id",
  "workflowId",
  "networkAllowlist",
  "credentialAllowlist",
  "toolsAllowlist",
  "filesystemScope",
  "costCeilingUsd",
  "consequentialApprovals",
  "mcpAllowlist",
  "scope",
  "reason",
]);

const STRING_ARRAY_KEYS = [
  "networkAllowlist",
  "credentialAllowlist",
  "toolsAllowlist",
  "mcpAllowlist",
] as const;

/**
 * Operator pack directory: explicit config, then `MSTRMND_OPERATOR_PACK`,
 * then the vault path (an operator pack doubles as a vault root).
 */
export function resolveOperatorPackDir(
  explicit?: string,
  fallback?: string
): string | undefined {
  const fromEnv = process.env.MSTRMND_OPERATOR_PACK?.trim();
  const dir = explicit?.trim() || fromEnv || fallback;
  return dir ? resolve(dir) : undefined;
}

export function operatorPackBoundaryPath(packDir: string): string {
  return join(packDir, OPERATOR_PACK_BOUNDARY_FILE);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function invalid(path: string, detail: string): MissingBoundaryError {
  return new MissingBoundaryError(`${path}: ${detail}`);
}

/**
 * Load a ThreatBoundary from `<pack>/boundary.json`.
 *
 * - Absent file → `null`; the caller falls back to the Operator Zero default.
 * - Present but unreadable, malformed, or structurally invalid → throws
 *   `MissingBoundaryError`. A misconfigured pack must fail closed rather than
 *   silently run under a different boundary.
 *
 * `model.complete` is added to the tool allow-list (parity with
 * `operatorZeroBoundary`); it is intrinsic to any run and carries no egress
 * permission on its own — network and credential allow-lists still apply.
 */
export async function loadOperatorPackBoundary(
  packDir: string,
  opts: { scope?: RuntimeScope } = {}
): Promise<ThreatBoundary | null> {
  const path = operatorPackBoundaryPath(packDir);
  if (!existsSync(path)) return null;

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw invalid(path, `cannot read (${err instanceof Error ? err.message : String(err)})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw invalid(path, `invalid JSON (${err instanceof Error ? err.message : String(err)})`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalid(path, "boundary must be a JSON object");
  }

  const record = parsed as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((k) => !BOUNDARY_KEYS.has(k));
  if (unknownKeys.length) {
    throw invalid(path, `unknown keys: ${unknownKeys.join(", ")}`);
  }

  for (const key of STRING_ARRAY_KEYS) {
    if (!isStringArray(record[key])) {
      throw invalid(path, `${key} must be an array of strings`);
    }
  }

  const fsScope = record.filesystemScope;
  if (
    !Array.isArray(fsScope) ||
    !fsScope.every(
      (e) =>
        e &&
        typeof e === "object" &&
        typeof (e as Record<string, unknown>).mountId === "string" &&
        typeof (e as Record<string, unknown>).pathPrefix === "string"
    )
  ) {
    throw invalid(path, "filesystemScope must be an array of { mountId, pathPrefix } strings");
  }

  const approvals = record.consequentialApprovals;
  if (!isStringArray(approvals)) {
    throw invalid(path, "consequentialApprovals must be an array of strings");
  }
  const known = CONSEQUENTIAL_ACTIONS as readonly string[];
  const unknownApprovals = approvals.filter((a) => !known.includes(a));
  if (unknownApprovals.length) {
    throw invalid(
      path,
      `unknown consequentialApprovals: ${unknownApprovals.join(", ")} (allowed: ${known.join(", ")})`
    );
  }

  if (record.scope !== undefined) {
    const s = record.scope as Record<string, unknown> | null;
    if (
      !s ||
      typeof s !== "object" ||
      typeof s.organizationId !== "string" ||
      typeof s.workspaceId !== "string" ||
      typeof s.userId !== "string"
    ) {
      throw invalid(path, "scope must have organizationId, workspaceId, userId strings");
    }
  }
  if (record.reason !== undefined && typeof record.reason !== "string") {
    throw invalid(path, "reason must be a string");
  }

  const { $schema: _schema, ...rest } = record;
  const candidate = rest as unknown as ThreatBoundary;
  try {
    assertBoundary(candidate);
  } catch (err) {
    throw invalid(path, err instanceof Error ? err.message : String(err));
  }

  return {
    ...candidate,
    toolsAllowlist: [...new Set([...candidate.toolsAllowlist, "model.complete"])],
    scope: candidate.scope ?? opts.scope,
  };
}
