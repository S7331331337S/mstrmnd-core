import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ContextPack, MemoryNode, RuntimeScope } from "@mstrmnd/schemas";
import { MemoryEngine } from "./memory-engine";
import { loadIdentity } from "./identity-loader";
import {
  loadDoctrinePin,
  readDoctrineFile,
  resolveRepoRoot,
  summarizeMarkdown,
} from "./doctrine-loader";
import { loadCompanyProfile, loadOperatorProfile } from "./profile-loader";
import { nowIso, resolveScope } from "./operator-scope";
import { resolveVaultPath } from "./vault-path";

export interface AssembleContextOptions {
  vaultPath?: string;
  repoRoot?: string;
  scope?: Partial<RuntimeScope>;
  /** Keyword query for memory hits; empty skips search */
  memoryQuery?: string;
  memoryLimit?: number;
  /** Extra roots to search for company.md / operator.md (e.g. templates/) */
  extraProfileRoots?: string[];
  /** Preloaded memory engine; if omitted and vault exists, loads vault */
  memory?: MemoryEngine;
}

const DOCTRINE_SLICE_PATHS = [
  "company/philosophy.md",
  "strategy/positioning.md",
  "platform/intelligence-architecture.md",
];

export async function assembleContext(
  options: AssembleContextOptions = {}
): Promise<ContextPack> {
  const scope = resolveScope(options.scope);
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const vaultPath = options.vaultPath ?? resolveVaultPath();
  const templatesRoot = join(repoRoot, "templates");

  const profileRoots = [
    ...(options.extraProfileRoots ?? []),
    vaultPath,
    templatesRoot,
  ].filter((p) => existsSync(p));

  const pin = await loadDoctrinePin(repoRoot);
  const doctrineRef =
    pin?.status === "active" && pin.ref ? pin.ref : pin?.ref ?? null;

  const operator = await loadOperatorProfile(profileRoots, scope);
  const { company, business } = await loadCompanyProfile(profileRoots, scope);

  let identity = await loadIdentity(vaultPath, scope);
  // If vault identity empty, try templates
  if (
    !identity.values.length &&
    !identity.interests.length &&
    existsSync(join(templatesRoot, "identity.md"))
  ) {
    identity = await loadIdentity(templatesRoot, scope);
  }

  let memory = options.memory;
  if (!memory && existsSync(vaultPath)) {
    memory = new MemoryEngine();
    await memory.loadVault(vaultPath, { scope });
  }

  let memoryHits: MemoryNode[] = [];
  if (memory && options.memoryQuery?.trim()) {
    memoryHits = memory
      .search(options.memoryQuery)
      .memories.slice(0, options.memoryLimit ?? 5);
  }

  const doctrineSlice: ContextPack["doctrineSlice"] = [];
  for (const path of DOCTRINE_SLICE_PATHS) {
    const md = await readDoctrineFile(path, repoRoot);
    if (!md) continue;
    doctrineSlice.push({ path, summary: summarizeMarkdown(md) });
  }

  // Prefer doctrine positioning mission if company mission empty
  if (!company.missionSummary && doctrineSlice.length) {
    const pos = doctrineSlice.find((d) => d.path.includes("positioning"));
    if (pos) company.missionSummary = pos.summary.slice(0, 240);
  }

  return {
    scope,
    doctrineRef,
    operator,
    company,
    business,
    identity,
    memoryHits,
    workspaceRoots: existsSync(vaultPath) ? [vaultPath] : [],
    doctrineSlice: doctrineSlice.length ? doctrineSlice : undefined,
    assembledAt: nowIso(),
  };
}
