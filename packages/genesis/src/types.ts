/**
 * MSTRMND Genesis protocol types.
 *
 * IdentityModel (values/interests loaded from identity.md) remains the
 * profile projection. These types are the cryptographic identity and
 * evidence ledger — they do not replace IdentityModel or AuditEvent.
 */

export const GENESIS_SCHEMA = "mstrmnd.genesis/v1" as const;
export const EVENT_SCHEMA = "mstrmnd.event/v1" as const;
export const BATCH_SCHEMA = "mstrmnd.batch/v1" as const;
export const AGENT_ID_PREFIX = "mstrmnd:agent:" as const;
export const WITNESS_HANDLE = "mstrmnd:witness:platform" as const;

export type GenesisEventType =
  | "genesis.created"
  | "identity.amended"
  | "instructions.versioned"
  | "model.completed"
  | "tool.proposed"
  | "tool.approved"
  | "tool.execution.completed"
  | "memory.written"
  | "memory.superseded"
  | "subagent.spawned"
  | "policy.decided"
  | "run.completed"
  | "error.raised";

export interface GenesisController {
  type: string;
  id: string;
}

export interface GenesisPublicKey {
  type: "Ed25519";
  multibase: string;
}

export interface GenesisIdentity {
  purpose: string;
  values: string[];
  boundaries: string[];
}

export interface GenesisRuntimePolicy {
  frameworks: string[];
  modelPolicy: string;
  approvalPolicy: string;
}

export interface GenesisArtifacts {
  instructionsHash: string;
  skillsRoot: string;
  toolsRoot: string;
  policyHash: string;
}

export interface GenesisLineage {
  parentAgentId: string | null;
  generation: number;
}

export interface GenesisManifest {
  schema: typeof GENESIS_SCHEMA;
  agentId: string;
  name: string;
  createdAt: string;
  controller: GenesisController;
  publicKey: GenesisPublicKey;
  didKey: string;
  identity: GenesisIdentity;
  runtimePolicy: GenesisRuntimePolicy;
  artifacts: GenesisArtifacts;
  lineage: GenesisLineage;
}

export interface SignedGenesis {
  schema: typeof GENESIS_SCHEMA;
  agentId: string;
  didKey: string;
  manifest: GenesisManifest;
  manifestHash: string;
  signature: string;
}

export interface GenesisActor {
  agentId: string;
  humanSubject?: string;
}

export interface GenesisRuntime {
  framework: string;
  model?: string;
  gateway?: string;
}

export interface GenesisEvent {
  schema: typeof EVENT_SCHEMA;
  agentId: string;
  sequence: number;
  eventType: GenesisEventType;
  timestamp: string;
  sessionId?: string;
  runId?: string;
  actor: GenesisActor;
  runtime: GenesisRuntime;
  payloadHash: string;
  previousEventHash: string | null;
  policyVersion: number;
  agentSignature: string;
  witnessSignature: string;
}

/** Event fields that are signed. Signatures themselves are excluded. */
export type UnsignedGenesisEvent = Omit<
  GenesisEvent,
  "agentSignature" | "witnessSignature"
>;

export interface UnsignedObservation {
  agentId: string;
  eventType: GenesisEventType;
  timestamp?: string;
  sessionId?: string;
  runId?: string;
  actor?: GenesisActor;
  runtime?: GenesisRuntime;
  payload: unknown;
  policyVersion?: number;
}

export type AnchorKind = "log" | "evm" | "rekor";

export interface MerkleBatch {
  schema: typeof BATCH_SCHEMA;
  agentId: string;
  fromSequence: number;
  toSequence: number;
  root: string;
  eventHashes: string[];
  anchoredAt: string;
  anchor: {
    kind: AnchorKind;
    ref?: string;
  };
}

export interface MerkleProof {
  root: string;
  leaf: string;
  index: number;
  siblings: Array<{ side: "left" | "right"; hash: string }>;
}

export type MemoryKind = "identity" | "episodic" | "semantic" | "procedural";

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  key: string;
  content: string;
  supersedes?: string | null;
  reason?: string;
  sourceEventId?: string;
  revoked?: boolean;
  createdAt: string;
}

export interface Keystore {
  createKeyPair(handle: string): Promise<{ handle: string; publicKeyRaw: Uint8Array }>;
  getPublicKey(handle: string): Promise<Uint8Array>;
  sign(handle: string, data: Uint8Array): Promise<Uint8Array>;
  has(handle: string): Promise<boolean>;
}

export interface LedgerStore {
  append(event: GenesisEvent): Promise<void>;
  getTip(agentId: string): Promise<GenesisEvent | null>;
  list(
    agentId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<GenesisEvent[]>;
  get(agentId: string, sequence: number): Promise<GenesisEvent | null>;
}

export interface AgentRecord {
  agentId: string;
  name: string;
  workspaceId?: string;
  /** Keystore handle that holds this agent's private key (may equal agentId). */
  keyHandle: string;
  signed: SignedGenesis;
  createdAt: string;
}

export interface AgentRegistry {
  put(record: AgentRecord): Promise<void>;
  get(agentId: string): Promise<AgentRecord | null>;
  getByName(workspaceId: string, name: string): Promise<AgentRecord | null>;
  list(workspaceId?: string): Promise<AgentRecord[]>;
}

export interface AnchorAdapter {
  kind: AnchorKind;
  publish(root: string, meta: Record<string, unknown>): Promise<{ ref: string }>;
}

export interface VerifyResult {
  ok: boolean;
  checks: {
    agentSignature: boolean;
    witnessSignature: boolean;
    chain: boolean;
    merkle?: boolean;
  };
  reasons: string[];
}
