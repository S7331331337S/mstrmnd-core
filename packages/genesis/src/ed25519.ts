import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

export function generateEd25519(): {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicKeyRaw: Buffer;
  privateKeyRaw: Buffer;
} {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyRaw = spkiToRaw(publicKey);
  const privateKeyRaw = pkcs8ToRaw(privateKey);
  return { privateKey, publicKey, publicKeyRaw, privateKeyRaw };
}

export function spkiToRaw(publicKey: KeyObject): Buffer {
  const der = publicKey.export({ type: "spki", format: "der" });
  return Buffer.from(der.subarray(der.length - 32));
}

export function pkcs8ToRaw(privateKey: KeyObject): Buffer {
  const der = privateKey.export({ type: "pkcs8", format: "der" });
  return Buffer.from(der.subarray(der.length - 32));
}

export function publicKeyFromRaw(raw: Uint8Array): KeyObject {
  if (raw.length !== 32) throw new Error("Ed25519 public key must be 32 bytes");
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(raw)]),
    format: "der",
    type: "spki",
  });
}

export function privateKeyFromRaw(seed: Uint8Array): KeyObject {
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes");
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(seed)]),
    format: "der",
    type: "pkcs8",
  });
}

export function signEd25519(
  privateKey: KeyObject,
  data: Uint8Array | Buffer,
): Buffer {
  return cryptoSign(null, data, privateKey);
}

export function verifyEd25519(
  publicKey: KeyObject,
  data: Uint8Array | Buffer,
  signature: Uint8Array | Buffer,
): boolean {
  return cryptoVerify(null, data, publicKey, signature);
}

export function exportPkcs8Der(privateKey: KeyObject): Buffer {
  return Buffer.from(privateKey.export({ type: "pkcs8", format: "der" }));
}

export function importPkcs8Der(der: Uint8Array): KeyObject {
  return createPrivateKey({ key: Buffer.from(der), format: "der", type: "pkcs8" });
}
