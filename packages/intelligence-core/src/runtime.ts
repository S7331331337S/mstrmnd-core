import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ContextPack } from "@mstrmnd/schemas";
import { MemoryEngine } from "./memory-engine";
import { WorkspaceService } from "./workspace-service";
import { assembleContext } from "./context-assembler";
import { resolveVaultPath } from "./vault-path";
import { resolveRepoRoot } from "./doctrine-loader";
import {
  EchoProvider,
  resolveModelProvider,
  type ModelProvider,
} from "./model-provider";
import { Orchestrator } from "./orchestrator";
import { createGenesisRuntime } from "./genesis-runtime";
import { loadIdentity, EMPTY_IDENTITY } from "./identity-loader";
import type { IdentityModel } from "@mstrmnd/schemas";

export interface RuntimeConfig {
  vaultPath?: string;
  repoRoot?: string;
  memoryQuery?: string;
  modelProvider?: string;
  /** Skip loading vault if missing */
  allowMissingVault?: boolean;
}

export interface MstrmndRuntime {
  config: Required<Pick<RuntimeConfig, "vaultPath" | "repoRoot">> & RuntimeConfig;
  memory: MemoryEngine;
  workspace: WorkspaceService;
  context: ContextPack;
  identity: IdentityModel;
  provider: ModelProvider;
  createOrchestrator: (opts?: { dryRun?: boolean }) => Orchestrator;
}

/**
 * Shared runtime factory for Hermes CLI and MCP plugin hosts.
 */
export async function createRuntime(
  config: RuntimeConfig = {}
): Promise<MstrmndRuntime> {
  const repoRoot = resolveRepoRoot(config.repoRoot);
  const vaultPath = config.vaultPath ?? resolveVaultPath();
  const memory = new MemoryEngine();
  const workspace = new WorkspaceService();
  let identity: IdentityModel = { ...EMPTY_IDENTITY };

  if (existsSync(vaultPath)) {
    await memory.loadVault(vaultPath);
    identity = await loadIdentity(vaultPath);
    workspace.registerVaultMount(vaultPath);
  } else if (!config.allowMissingVault) {
    // Still allow templates-only context assembly
  }

  // Also mount templates as a secondary filesystem mount when present
  const templatesRoot = join(repoRoot, "templates");
  if (existsSync(templatesRoot)) {
    try {
      workspace.registerMount({
        id: "templates",
        rootPath: templatesRoot,
        adapter: "filesystem",
        label: "Repo templates",
        scope: memory.all()[0]?.scope ?? identity.scope,
        provenance: {
          source: "filesystem",
          adapter: "runtime-factory",
          ingestedAt: new Date().toISOString(),
          sourcePath: templatesRoot,
        },
      });
    } catch {
      // ignore mount errors
    }
  }

  const context = await assembleContext({
    vaultPath,
    repoRoot,
    memory,
    memoryQuery: config.memoryQuery,
  });

  // Prefer assembled identity (includes templates fallback)
  identity = context.identity;

  const provider = resolveModelProvider(config.modelProvider);
  const genesis = createGenesisRuntime(repoRoot);

  return {
    config: { ...config, vaultPath, repoRoot },
    memory,
    workspace,
    context,
    identity,
    provider,
    createOrchestrator: (opts) =>
      new Orchestrator({
        context,
        memory,
        workspace,
        provider,
        repoRoot,
        dryRun: opts?.dryRun,
        genesis,
      }),
  };
}

export { EchoProvider };
