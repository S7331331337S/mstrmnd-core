import { createHash } from "node:crypto";

export function sha256Raw(data: Uint8Array | Buffer | string): Buffer {
  return createHash("sha256").update(data).digest();
}

export function sha256Hex(data: Uint8Array | Buffer | string): string {
  return sha256Raw(data).toString("hex");
}

/** Portable hash form used on the wire: `sha256:<hex>`. */
export function sha256Prefixed(data: Uint8Array | Buffer | string): string {
  return formatDigest(sha256Raw(data));
}

/** Encode an existing 32-byte digest without hashing it again. */
export function formatDigest(digest: Uint8Array | Buffer): string {
  return `sha256:${Buffer.from(digest).toString("hex")}`;
}

export function parseSha256Prefixed(value: string): Buffer {
  const hex = value.startsWith("sha256:") ? value.slice(7) : value;
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(`invalid sha256 hash: ${value}`);
  }
  return Buffer.from(hex, "hex");
}

export function isSha256Prefixed(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/i.test(value);
}
