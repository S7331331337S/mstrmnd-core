import { AGENT_ID_PREFIX } from "./types";
import { base58btc, base64url } from "./encoding";
import { sha256Raw } from "./hash";

const ED25519_MULTICODEC = Buffer.from([0xed, 0x01]);

/**
 * Permanent agent id:
 * `mstrmnd:agent:` + base64url(sha256(ed25519_public_key)) (no padding, 43 chars).
 */
export function agentIdFromPublicKey(publicKeyRaw: Uint8Array): string {
  const digest = sha256Raw(Buffer.from(publicKeyRaw));
  return `${AGENT_ID_PREFIX}${base64url(digest)}`;
}

/** Multibase (base58btc) encoding of an Ed25519 public key (`z6Mk…`). */
export function publicKeyMultibase(publicKeyRaw: Uint8Array): string {
  const tagged = Buffer.concat([ED25519_MULTICODEC, Buffer.from(publicKeyRaw)]);
  return `z${base58btc(tagged)}`;
}

/** W3C did:key identifier for the same Ed25519 public key. */
export function didKeyFromPublicKey(publicKeyRaw: Uint8Array): string {
  return `did:key:${publicKeyMultibase(publicKeyRaw)}`;
}

export function isAgentId(value: string): boolean {
  return (
    value.startsWith(AGENT_ID_PREFIX) &&
    value.length === AGENT_ID_PREFIX.length + 43
  );
}

export function agentIdSuffix(agentId: string): string {
  if (!agentId.startsWith(AGENT_ID_PREFIX)) {
    throw new Error(`not a genesis agent id: ${agentId}`);
  }
  return agentId.slice(AGENT_ID_PREFIX.length);
}
