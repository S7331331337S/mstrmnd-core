import type {
  GenesisEvent,
  GenesisManifest,
  Keystore,
  LedgerStore,
  SignedGenesis,
  UnsignedObservation,
  VerifyResult,
} from "./types";
import { EVENT_SCHEMA, GENESIS_SCHEMA, WITNESS_HANDLE } from "./types";
import { canonicalizeBytes } from "./canonical";
import { sha256Prefixed } from "./hash";
import { redact } from "./redact";
import { eventBodyBytes, eventHash } from "./event-hash";
import { base64url, fromBase64url } from "./encoding";
import { publicKeyFromRaw, verifyEd25519 } from "./ed25519";
import {
  agentIdFromPublicKey,
  didKeyFromPublicKey,
  publicKeyMultibase,
} from "./identity";
import type { MerkleProof } from "./types";
import { verifyInclusion } from "./merkle";

export function encodeSignature(sig: Uint8Array): string {
  return `ed25519:${base64url(sig)}`;
}

export function decodeSignature(value: string): Buffer {
  const raw = value.startsWith("ed25519:") ? value.slice(8) : value;
  return fromBase64url(raw);
}

export function keyHandleForName(workspaceId: string | undefined, name: string): string {
  return `agent:${workspaceId ?? "_"}:${name}`;
}

export async function ensureWitnessKey(keystore: Keystore): Promise<string> {
  if (!(await keystore.has(WITNESS_HANDLE))) {
    await keystore.createKeyPair(WITNESS_HANDLE);
  }
  return WITNESS_HANDLE;
}

export interface IssueGenesisInput {
  keystore: Keystore;
  name: string;
  controller: GenesisManifest["controller"];
  identity: GenesisManifest["identity"];
  runtimePolicy: GenesisManifest["runtimePolicy"];
  artifacts: GenesisManifest["artifacts"];
  lineage?: GenesisManifest["lineage"];
  createdAt?: string;
  workspaceId?: string;
}

/**
 * Issue a genesis identity. The keystore handle is stable per workspace+name
 * so re-issuing is idempotent (same key, same agent id). The permanent
 * `agentId` is derived from the public key, not from the handle.
 */
export async function issueGenesis(input: IssueGenesisInput): Promise<{
  signed: SignedGenesis;
  publicKeyRaw: Uint8Array;
  handle: string;
}> {
  const handle = keyHandleForName(input.workspaceId, input.name);
  const { publicKeyRaw } = await input.keystore.createKeyPair(handle);
  const agentId = agentIdFromPublicKey(publicKeyRaw);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const manifest: GenesisManifest = {
    schema: GENESIS_SCHEMA,
    agentId,
    name: input.name,
    createdAt,
    controller: input.controller,
    publicKey: {
      type: "Ed25519",
      multibase: publicKeyMultibase(publicKeyRaw),
    },
    didKey: didKeyFromPublicKey(publicKeyRaw),
    identity: input.identity,
    runtimePolicy: input.runtimePolicy,
    artifacts: input.artifacts,
    lineage: input.lineage ?? { parentAgentId: null, generation: 0 },
  };
  const body = canonicalizeBytes(manifest);
  const manifestHash = sha256Prefixed(body);
  const sig = await input.keystore.sign(handle, body);
  const signed: SignedGenesis = {
    schema: GENESIS_SCHEMA,
    agentId,
    didKey: manifest.didKey,
    manifest,
    manifestHash,
    signature: encodeSignature(sig),
  };
  return { signed, publicKeyRaw, handle };
}

export interface AcceptObservationInput {
  observation: UnsignedObservation;
  ledger: LedgerStore;
  keystore: Keystore;
  /** Keystore handle that holds the agent's private key. */
  agentHandle: string;
  witnessHandle?: string;
}

export async function acceptObservation(
  input: AcceptObservationInput,
): Promise<GenesisEvent> {
  const witnessHandle =
    input.witnessHandle ?? (await ensureWitnessKey(input.keystore));
  const redacted = redact(input.observation.payload, {
    hashLarge: (v) => sha256Prefixed(Buffer.from(v, "utf8")),
  });
  const payloadHash = sha256Prefixed(canonicalizeBytes(redacted));
  const tip = await input.ledger.getTip(input.observation.agentId);
  const sequence = tip ? tip.sequence + 1 : 1;
  const previousEventHash = tip ? eventHash(tip) : null;
  const unsigned = {
    schema: EVENT_SCHEMA,
    agentId: input.observation.agentId,
    sequence,
    eventType: input.observation.eventType,
    timestamp: input.observation.timestamp ?? new Date().toISOString(),
    sessionId: input.observation.sessionId,
    runId: input.observation.runId,
    actor: input.observation.actor ?? { agentId: input.observation.agentId },
    runtime: input.observation.runtime ?? { framework: "unknown" },
    payloadHash,
    previousEventHash,
    policyVersion: input.observation.policyVersion ?? 0,
  } satisfies Omit<GenesisEvent, "agentSignature" | "witnessSignature">;

  const body = eventBodyBytes(unsigned);
  const agentSig = await input.keystore.sign(input.agentHandle, body);
  const witnessSig = await input.keystore.sign(witnessHandle, body);
  const event: GenesisEvent = {
    ...unsigned,
    agentSignature: encodeSignature(agentSig),
    witnessSignature: encodeSignature(witnessSig),
  };
  await input.ledger.append(event);
  return event;
}

export async function verifyManifest(
  signed: SignedGenesis,
  publicKeyRaw: Uint8Array,
): Promise<boolean> {
  const body = canonicalizeBytes(signed.manifest);
  if (sha256Prefixed(body) !== signed.manifestHash) return false;
  return verifyEd25519(
    publicKeyFromRaw(publicKeyRaw),
    body,
    decodeSignature(signed.signature),
  );
}

export async function verifyEvent(opts: {
  event: GenesisEvent;
  previous?: GenesisEvent | null;
  agentPublicKey: Uint8Array;
  witnessPublicKey: Uint8Array;
  merkle?: MerkleProof;
}): Promise<VerifyResult> {
  const reasons: string[] = [];
  const body = eventBodyBytes(opts.event);
  const agentSignature = verifyEd25519(
    publicKeyFromRaw(opts.agentPublicKey),
    body,
    decodeSignature(opts.event.agentSignature),
  );
  if (!agentSignature) reasons.push("agent signature invalid");
  const witnessSignature = verifyEd25519(
    publicKeyFromRaw(opts.witnessPublicKey),
    body,
    decodeSignature(opts.event.witnessSignature),
  );
  if (!witnessSignature) reasons.push("witness signature invalid");

  let chain = true;
  if (opts.event.sequence === 1) {
    if (opts.event.previousEventHash !== null) {
      chain = false;
      reasons.push("genesis event must have null previousEventHash");
    }
  } else if (opts.previous) {
    if (eventHash(opts.previous) !== opts.event.previousEventHash) {
      chain = false;
      reasons.push("previousEventHash does not match previous event");
    }
    if (opts.previous.sequence + 1 !== opts.event.sequence) {
      chain = false;
      reasons.push("sequence is not tip+1");
    }
  } else if (opts.event.previousEventHash == null) {
    chain = false;
    reasons.push("non-genesis event missing previousEventHash");
  }

  let merkle: boolean | undefined;
  if (opts.merkle) {
    merkle =
      opts.merkle.leaf === eventHash(opts.event) && verifyInclusion(opts.merkle);
    if (!merkle) reasons.push("merkle inclusion proof failed");
  }

  const ok =
    agentSignature &&
    witnessSignature &&
    chain &&
    (merkle === undefined || merkle);
  return {
    ok,
    checks: { agentSignature, witnessSignature, chain, merkle },
    reasons,
  };
}
