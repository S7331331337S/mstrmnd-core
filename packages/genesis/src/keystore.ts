import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import type { Keystore } from "./types";
import {
  exportPkcs8Der,
  generateEd25519,
  importPkcs8Der,
  signEd25519,
} from "./ed25519";
import { base64url, fromBase64url } from "./encoding";

interface StoredKey {
  handle: string;
  publicKeyRaw: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

function wrapHandle(handle: string): string {
  return handle.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/**
 * Encrypted file keystore. Private keys never enter agent sandboxes or the
 * ledger. Selected by `MSTRMND_KEYSTORE=local` (default). AWS/GCP/Turnkey
 * adapters implement the same `Keystore` interface.
 */
export class LocalKeystore implements Keystore {
  private readonly dir: string;
  private readonly secret: string;
  private readonly salt: Buffer;

  constructor(opts: { dir: string; secret?: string }) {
    this.dir = opts.dir;
    this.secret =
      opts.secret ??
      process.env.MSTRMND_KEYSTORE_SECRET ??
      process.env.AUTH_SECRET ??
      "mstrmnd-dev-keystore";
    mkdirSync(this.dir, { recursive: true });
    const saltPath = join(this.dir, ".salt");
    if (existsSync(saltPath)) {
      this.salt = readFileSync(saltPath);
    } else {
      this.salt = randomBytes(16);
      writeFileSync(saltPath, this.salt, { mode: 0o600 });
    }
  }

  private pathFor(handle: string): string {
    return join(this.dir, `${wrapHandle(handle)}.json`);
  }

  private kek(): Buffer {
    return scryptSync(this.secret, this.salt, 32) as Buffer;
  }

  async has(handle: string): Promise<boolean> {
    return existsSync(this.pathFor(handle));
  }

  async createKeyPair(
    handle: string,
  ): Promise<{ handle: string; publicKeyRaw: Uint8Array }> {
    if (await this.has(handle)) {
      const existing = await this.getPublicKey(handle);
      return { handle, publicKeyRaw: existing };
    }
    const { privateKey, publicKeyRaw } = generateEd25519();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.kek(), iv);
    const plain = exportPkcs8Der(privateKey);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    const stored: StoredKey = {
      handle,
      publicKeyRaw: base64url(publicKeyRaw),
      iv: base64url(iv),
      tag: base64url(tag),
      ciphertext: base64url(enc),
    };
    writeFileSync(this.pathFor(handle), JSON.stringify(stored), {
      mode: 0o600,
    });
    return { handle, publicKeyRaw };
  }

  async getPublicKey(handle: string): Promise<Uint8Array> {
    const stored = this.read(handle);
    return fromBase64url(stored.publicKeyRaw);
  }

  async sign(handle: string, data: Uint8Array): Promise<Uint8Array> {
    const stored = this.read(handle);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.kek(),
      fromBase64url(stored.iv),
    );
    decipher.setAuthTag(fromBase64url(stored.tag));
    const der = Buffer.concat([
      decipher.update(fromBase64url(stored.ciphertext)),
      decipher.final(),
    ]);
    const key = importPkcs8Der(der);
    return signEd25519(key, Buffer.from(data));
  }

  listHandles(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          const stored = JSON.parse(
            readFileSync(join(this.dir, f), "utf8"),
          ) as StoredKey;
          return stored.handle;
        } catch {
          return "";
        }
      })
      .filter(Boolean);
  }

  private read(handle: string): StoredKey {
    const path = this.pathFor(handle);
    if (!existsSync(path)) throw new Error(`keystore missing handle: ${handle}`);
    return JSON.parse(readFileSync(path, "utf8")) as StoredKey;
  }
}
