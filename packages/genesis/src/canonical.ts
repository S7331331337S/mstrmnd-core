/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) for JSON values.
 *
 * Objects have lexicographically sorted keys; arrays keep order; numbers use
 * ECMAScript NumberToString (JSON.stringify). Sufficient for our constrained
 * genesis/event schemas (strings, ints, booleans, nested objects/arrays).
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export function toJsonValue(input: unknown): JsonValue {
  if (input === null || typeof input === "boolean" || typeof input === "string") {
    return input;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new Error("JCS cannot encode non-finite numbers");
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(toJsonValue);
  }
  if (typeof input === "object") {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = toJsonValue(v);
    }
    return out;
  }
  throw new Error(`JCS cannot encode ${typeof input}`);
}

function serialize(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${serialize(value[k])}`);
  return `{${parts.join(",")}}`;
}

/** Canonical JSON string (UTF-8, no insignificant whitespace, sorted keys). */
export function canonicalize(input: unknown): string {
  return serialize(toJsonValue(input));
}

export function canonicalizeBytes(input: unknown): Buffer {
  return Buffer.from(canonicalize(input), "utf8");
}
