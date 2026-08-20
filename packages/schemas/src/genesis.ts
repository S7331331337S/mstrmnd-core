/**
 * Genesis protocol types. Runtime (keystore, ledger, verify) lives in
 * `@mstrmnd/genesis` so mstrmnd-os can take a `file:` dependency without
 * pulling the rest of intelligence-core.
 *
 * How this relates to existing schemas:
 * - `IdentityModel` remains the loaded profile from `identity.md` (values,
 *   interests, preferences). Genesis hashes that file as an artifact; it does
 *   not replace the profile.
 * - `AuditEvent` remains the JSONL audit projection written by the Hermes
 *   orchestrator. `GenesisEvent` is the canonical dual-signed hash chain.
 */
export type {
  AgentRecord,
  GenesisEvent,
  GenesisEventType,
  GenesisManifest,
  MerkleBatch,
  MerkleProof,
  SignedGenesis,
  UnsignedObservation,
  VerifyResult,
} from "@mstrmnd/genesis";
export {
  AGENT_ID_PREFIX,
  EVENT_SCHEMA,
  GENESIS_SCHEMA,
} from "@mstrmnd/genesis";
