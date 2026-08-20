import { canonicalizeBytes } from "./canonical";
import { sha256Prefixed } from "./hash";
import type { GenesisEvent, UnsignedGenesisEvent } from "./types";

export function unsignedEvent(event: GenesisEvent): UnsignedGenesisEvent {
  const {
    agentSignature: _a,
    witnessSignature: _w,
    ...rest
  } = event;
  return rest;
}

export function eventBodyBytes(event: UnsignedGenesisEvent | GenesisEvent): Buffer {
  if ("agentSignature" in event) {
    return canonicalizeBytes(unsignedEvent(event as GenesisEvent));
  }
  return canonicalizeBytes(event);
}

export function eventHash(event: GenesisEvent): string {
  return sha256Prefixed(canonicalizeBytes(event));
}
