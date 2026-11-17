import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ContextPack, ThreatBoundary } from "@mstrmnd/schemas";
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
import { Orchestrator, OPERATOR_AGENT } from "./orchestrator";
import { operatorZeroBoundary } from "./policy-boundary";
import { loadEgressConfig, type EgressConfig } from "./egress";
import { loadIdentity, EMPTY_IDENTITY } from "./identity-loader";
import type { IdentityModel } from "@mstrmnd/schemas";
import type { WriteApprover } from "./write-approval";

export interface RuntimeConfig {
  /** Explicit operator-approved access boundary; default denies remote providers. */
  boundary?: ThreatBoundary;
  vaultPath?: string;
  repoRoot?: string;
  memoryQuery?: string;
  modelProvider?: string;
  /** Skip loading vault if missing */
  allowMissingVault?: boolean;
  /**
   * Resolve the model provider on first use instead of at construction.
   * Tools that don't need a model keep working with no provider configured;
   * `runtime.provider` and `createOrchestrator()` throw the usual fail-closed
   * error (naming MSTRMND_MODEL_PROVIDER) when first used. Default: eager.
   */
  lazyProvider?: boolean;
}

export interface MstrmndRuntime {
  config: Required<Pick<RuntimeConfig, "vaultPath" | "repoRoot">> & RuntimeConfig;
  memory: MemoryEngine;
  workspace: WorkspaceService;
  context: ContextPack;
  identity: IdentityModel;
  provider: ModelProvider;
  createOrchestrator: (opts?: {
    dryRun?: boolean;
    writeApprover?: WriteApprover;
  }) => Orchestrator;
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

  let resolved: ModelProvider | undefined;
  const getProvider = (): ModelProvider => (resolved ??= resolveModelProvider(config.modelProvider));
  if (!config.lazyProvider) getProvider();

  // Opt-in egress allowlist (MSTRMND_EGRESS_ALLOWLIST). Invalid values throw. With
  // lazyProvider the load is deferred like the provider, so non-model MCP tools
  // survive a bad value and only the model path fails closed.
  let egress: EgressConfig | undefined;
  const getEgress = (): EgressConfig => (egress ??= loadEgressConfig());
  if (!config.lazyProvider) getEgress();

  return {
    config: { ...config, vaultPath, repoRoot },
    memory,
    workspace,
    context,
    identity,
    get provider() {
      return getProvider();
    },
    createOrchestrator: (opts) =>
      new Orchestrator({
        context,
        memory,
        workspace,
        provider: getProvider(),
        modelBudget: getEgress().processBudget,
        repoRoot,
        dryRun: opts?.dryRun,
        writeApprover: opts?.writeApprover,
        boundary: config.boundary ?? operatorZeroBoundary({
          toolsAllowlist: [...OPERATOR_AGENT.toolsAllowlist],
          filesystemScope: workspace.listMounts().map((m) => ({
            mountId: m.id,
            pathPrefix: "",
          })),
          networkAllowlist: getEgress().networkAllowlist,
          credentialAllowlist: getEgress().credentialAllowlist,
        }),
      }),
  };
}

export { EchoProvider };
