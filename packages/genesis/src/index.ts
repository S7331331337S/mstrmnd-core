export type {
  AgentRecord,
  AgentRegistry,
  AnchorAdapter,
  AnchorKind,
  GenesisActor,
  GenesisArtifacts,
  GenesisController,
  GenesisEvent,
  GenesisEventType,
  GenesisIdentity,
  GenesisLineage,
  GenesisManifest,
  GenesisPublicKey,
  GenesisRuntime,
  GenesisRuntimePolicy,
  Keystore,
  LedgerStore,
  MemoryKind,
  MemoryRecord,
  MerkleBatch,
  MerkleProof,
  SignedGenesis,
  UnsignedGenesisEvent,
  UnsignedObservation,
  VerifyResult,
} from "./types";
export {
  AGENT_ID_PREFIX,
  BATCH_SCHEMA,
  EVENT_SCHEMA,
  GENESIS_SCHEMA,
  WITNESS_HANDLE,
} from "./types";

export { canonicalize, canonicalizeBytes, toJsonValue } from "./canonical";
export { sha256Hex, sha256Prefixed, sha256Raw, formatDigest, isSha256Prefixed } from "./hash";
export { base64url, base58btc, fromBase64url } from "./encoding";
export {
  generateEd25519,
  publicKeyFromRaw,
  privateKeyFromRaw,
  signEd25519,
  verifyEd25519,
  spkiToRaw,
} from "./ed25519";
export {
  agentIdFromPublicKey,
  didKeyFromPublicKey,
  publicKeyMultibase,
  isAgentId,
  agentIdSuffix,
} from "./identity";
export { redact } from "./redact";
export {
  merkleRoot,
  inclusionProof,
  verifyInclusion,
  merkleOfNamedBlobs,
} from "./merkle";
export { LocalKeystore } from "./keystore";
export { JsonlLedger, JsonAgentRegistry } from "./ledger";
export { LogAnchor, selectAnchor, batchEvents } from "./anchor";
export { eventHash, eventBodyBytes, unsignedEvent } from "./event-hash";
export {
  issueGenesis,
  acceptObservation,
  ensureWitnessKey,
  verifyManifest,
  verifyEvent,
  encodeSignature,
  decodeSignature,
  keyHandleForName,
} from "./witness";
export { currentMemoryView, supersedeMemory } from "./memory";
