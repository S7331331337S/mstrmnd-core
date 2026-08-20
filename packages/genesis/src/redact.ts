const SECRET_KEY =
  /^(?:.*[_-]?)?(?:api[_-]?key|password|passwd|secret|token|authorization|credential|private[_-]?key|access[_-]?key)(?:[_-]?.*)?$/i;

const SECRET_VALUE =
  /(?:sk-[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;

const REDACTED = "[redacted]";
const LARGE_BODY_BYTES = 8 * 1024;

export interface RedactOptions {
  /** Replace large string bodies with a hash placeholder. */
  hashLarge?: (value: string) => string;
  largeBodyBytes?: number;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Strip credentials, secret-shaped values, and oversized file bodies before
 * hashing a payload. The original is never stored on the ledger.
 */
export function redact(input: unknown, opts: RedactOptions = {}): unknown {
  const limit = opts.largeBodyBytes ?? LARGE_BODY_BYTES;
  return walk(input, opts, limit, false);
}

function walk(
  value: unknown,
  opts: RedactOptions,
  limit: number,
  parentLooksLikeBody: boolean,
): unknown {
  if (typeof value === "string") {
    if (SECRET_VALUE.test(value)) return REDACTED;
    if (parentLooksLikeBody && Buffer.byteLength(value, "utf8") > limit) {
      if (opts.hashLarge) return opts.hashLarge(value);
      return `[omitted:${Buffer.byteLength(value, "utf8")}b]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, opts, limit, parentLooksLikeBody));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k)) {
        out[k] = REDACTED;
        continue;
      }
      const bodyish = /^(?:content|body|text|file|blob|source|prompt|output)$/i.test(
        k,
      );
      out[k] = walk(v, opts, limit, bodyish);
    }
    return out;
  }
  return value;
}
