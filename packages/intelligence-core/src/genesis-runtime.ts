import { join } from "node:path";
import {
  JsonAgentRegistry,
  JsonlLedger,
  LocalKeystore,
  acceptObservation,
  issueGenesis,
  sha256Prefixed,
  type GenesisEventType,
  type Keystore,
  type LedgerStore,
  type SignedGenesis,
} from "@mstrmnd/genesis";
import type { AgentSpec } from "@mstrmnd/schemas";

export interface GenesisRuntime {
  keystore: Keystore;
  ledger: LedgerStore;
  registry: JsonAgentRegistry;
  dir: string;
}

export function createGenesisRuntime(repoRoot: string): GenesisRuntime {
  const dir = join(repoRoot, ".mstrmnd");
  return {
    dir,
    keystore: new LocalKeystore({ dir: join(dir, "keystore") }),
    ledger: new JsonlLedger(join(dir, "genesis", "events")),
    registry: new JsonAgentRegistry(join(dir, "genesis", "agents.json")),
  };
}

export async function ensureOrchestratorAgent(
  genesis: GenesisRuntime,
  spec: AgentSpec,
  opts: {
    workspaceId?: string;
    parentAgentId?: string | null;
    generation?: number;
  } = {},
): Promise<{ signed: SignedGenesis; handle: string }> {
  const workspaceId = opts.workspaceId ?? "operator-zero";
  const existing = await genesis.registry.getByName(workspaceId, spec.id);
  if (existing) {
    return { signed: existing.signed, handle: existing.keyHandle };
  }
  const issued = await issueGenesis({
    keystore: genesis.keystore,
    name: spec.id,
    workspaceId,
    controller: { type: "organization", id: "mstrmnd" },
    identity: {
      purpose: spec.description ?? spec.role,
      values: ["accuracy", "initiative", "traceability"],
      boundaries: ["no unapproved financial transactions"],
    },
    runtimePolicy: {
      frameworks: ["hermes"],
      modelPolicy: spec.modelHint ?? "general",
      approvalPolicy: "risk-tiered",
    },
    artifacts: {
      instructionsHash: sha256Prefixed(spec.description ?? spec.id),
      skillsRoot: sha256Prefixed(""),
      toolsRoot: sha256Prefixed(spec.toolsAllowlist.join("\n")),
      policyHash: sha256Prefixed(""),
    },
    lineage: {
      parentAgentId: opts.parentAgentId ?? null,
      generation: opts.generation ?? 0,
    },
  });
  await genesis.registry.put({
    agentId: issued.signed.agentId,
    name: spec.id,
    workspaceId,
    keyHandle: issued.handle,
    signed: issued.signed,
    createdAt: issued.signed.manifest.createdAt,
  });
  await acceptObservation({
    observation: {
      agentId: issued.signed.agentId,
      eventType: "genesis.created",
      payload: { manifestHash: issued.signed.manifestHash, specId: spec.id },
      runtime: { framework: "hermes" },
    },
    ledger: genesis.ledger,
    keystore: genesis.keystore,
    agentHandle: issued.handle,
  });
  return { signed: issued.signed, handle: issued.handle };
}

export async function emitGenesisEvent(
  genesis: GenesisRuntime,
  opts: {
    agentId: string;
    handle: string;
    eventType: GenesisEventType;
    payload: unknown;
    runId?: string;
    sessionId?: string;
    model?: string;
  },
): Promise<void> {
  await acceptObservation({
    observation: {
      agentId: opts.agentId,
      eventType: opts.eventType,
      payload: opts.payload,
      runId: opts.runId,
      sessionId: opts.sessionId,
      runtime: { framework: "hermes", model: opts.model },
    },
    ledger: genesis.ledger,
    keystore: genesis.keystore,
    agentHandle: opts.handle,
  });
}
