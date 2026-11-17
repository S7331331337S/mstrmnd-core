/**
 * Tool input schemas must have an object root for every provider we route to.
 *
 * OpenAI rejects a tool whose `parameters` root is not `{ "type": "object" }`
 * (`Invalid schema for function '<name>': schema must be a JSON Schema of
 * 'type: "object"', got 'type: "None"'`) and fails the WHOLE request, so one
 * bad tool takes down every chat turn. Zod 4's `z.discriminatedUnion` emits a
 * root `{ oneOf: [...] }` with no `type`, which is exactly that case.
 *
 * Two layers use the same normalizer:
 *
 * 1. `objectRootSchema()` wraps an authored tool schema at definition time.
 *    eve serializes it (and runs its own `closeObjectSchemas`) after our
 *    flattening, and runtime validation still uses the original Zod schema.
 * 2. `withToolSchemaGuard()` is AI SDK middleware on the provider model built
 *    in `model.ts`. It runs on the final `params.tools` right before the
 *    provider serializes the request, so any tool from any source (authored,
 *    MCP, subagent, eve built-in) is normalized or dropped with a warning
 *    instead of failing the turn.
 */
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";

type JsonObject = Record<string, unknown>;

const isRecord = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const EMPTY_OBJECT_SCHEMA: JsonObject = Object.freeze({
  type: "object",
  properties: Object.freeze({}),
}) as JsonObject;

export type NormalizedToolSchema =
  | { ok: true; schema: JsonObject; changed: boolean; reason?: string }
  | { ok: false; reason: string };

function emptyObject(reason: string): NormalizedToolSchema {
  return { ok: true, schema: { type: "object", properties: {} }, changed: true, reason };
}

function constType(value: unknown): string | undefined {
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return undefined;
}

/** `{ const: x }` or `{ enum: [x] }` is a literal; anything else is a plain schema. */
function literalOf(schema: unknown): { literal: true; value: unknown } | { literal: false } {
  if (!isRecord(schema)) return { literal: false };
  if ("const" in schema) return { literal: true, value: schema.const };
  if (Array.isArray(schema.enum) && schema.enum.length === 1) return { literal: true, value: schema.enum[0] };
  return { literal: false };
}

/** Flatten a root `oneOf`/`anyOf` whose branches are all object schemas. */
function flattenObjectUnion(schema: JsonObject, branches: unknown[]): NormalizedToolSchema {
  if (branches.length === 0) return emptyObject("empty union at root");
  if (!branches.every((b) => isRecord(b) && b.type === "object")) {
    return { ok: false, reason: "root union contains a non-object branch" };
  }
  const objects = branches as JsonObject[];
  const properties: JsonObject = {};
  // Every distinct variant of each property across branches, const ones included.
  const variants = new Map<string, unknown[]>();
  const requiredSets = objects.map(
    (b) => new Set(Array.isArray(b.required) ? (b.required as unknown[]).filter((k) => typeof k === "string") : []),
  );

  for (const branch of objects) {
    const props = isRecord(branch.properties) ? branch.properties : {};
    for (const [key, value] of Object.entries(props)) {
      const list = variants.get(key) ?? [];
      if (!list.some((v) => JSON.stringify(v) === JSON.stringify(value))) list.push(value);
      variants.set(key, list);
    }
  }
  // A property defined differently in different branches (e.g. `limit` max 50
  // for search but 65536 for read) is advertised as `anyOf` of every variant,
  // so no branch's valid inputs are excluded. Runtime validation stays exact.
  //
  // The only collapse is the discriminator case: when EVERY variant of a key is
  // a const (or single-value enum) of one primitive type, advertise one `enum`.
  // If any branch has a plain (non-const) schema for the key, the const variants
  // must not replace it, so the full `anyOf` is kept.
  for (const [key, list] of variants) {
    const description = list
      .map((v) => (isRecord(v) ? v.description : undefined))
      .find((d) => typeof d === "string");
    const literals = list.map(literalOf);
    if (literals.every((l) => l.literal)) {
      const values = literals.map((l) => l.value);
      const types = new Set(values.map(constType));
      const type = types.size === 1 ? [...types][0] : undefined;
      if (type) {
        properties[key] = { type, enum: values, ...(description ? { description } : {}) };
        continue;
      }
    }
    if (list.length === 1) {
      properties[key] = list[0];
      continue;
    }
    properties[key] = { anyOf: list, ...(description ? { description } : {}) };
  }

  const required = [...(requiredSets[0] ?? [])].filter((k) => requiredSets.every((s) => s.has(k)));
  const allClosed = objects.every((b) => b.additionalProperties === false);
  const out: JsonObject = {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    ...(allClosed ? { additionalProperties: false } : {}),
  };
  for (const key of ["description", "title", "$defs", "definitions"]) {
    if (schema[key] !== undefined) out[key] = schema[key];
  }
  return { ok: true, schema: out, changed: true, reason: "flattened root union into one object" };
}

/**
 * Normalize a tool input JSON Schema to an object root.
 * - missing / null / `{}` / `type: "None"|"null"` with nothing else -> `{type:"object",properties:{}}`
 * - root `oneOf`/`anyOf` of object branches -> one flat object (discriminator becomes an enum)
 * - already `type: "object"` -> returned untouched (same reference)
 * - anything else (primitive/array root, union with non-object branch) -> not recoverable
 */
export function normalizeToolInputSchema(schema: unknown): NormalizedToolSchema {
  if (schema === undefined || schema === null) return emptyObject("missing schema");
  if (schema === true) return emptyObject("boolean schema");
  if (!isRecord(schema)) return { ok: false, reason: `schema is ${typeof schema}, not an object` };

  const { type } = schema;
  if (type === "object") {
    if (isRecord(schema.properties) || schema.properties === undefined) {
      return { ok: true, schema, changed: false };
    }
    return { ok: false, reason: "object schema with invalid properties" };
  }
  if (Array.isArray(type) && type.includes("object")) {
    return { ok: true, schema: { ...schema, type: "object" }, changed: true, reason: "type array -> object" };
  }

  const union = Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : undefined;
  if (union !== undefined && (type === undefined || type === null || type === "None")) {
    return flattenObjectUnion(schema, union);
  }

  const missingType = type === undefined || type === null || type === "None" || type === "null" || type === "none";
  if (missingType) {
    if (isRecord(schema.properties)) {
      return { ok: true, schema: { ...schema, type: "object" }, changed: true, reason: "properties without type" };
    }
    const meaningful = Object.keys(schema).filter(
      (k) => !["type", "$schema", "description", "title", "additionalProperties"].includes(k),
    );
    if (meaningful.length === 0) return emptyObject(`root type ${JSON.stringify(type ?? "missing")}`);
    return { ok: false, reason: `untyped root with ${meaningful.join(", ")}` };
  }
  return { ok: false, reason: `root type ${JSON.stringify(type)} is not "object"` };
}

/* ------------------------------------------------------------------------ */
/* Layer 1: definition-time wrapper for authored Standard Schemas (Zod 4).   */
/* ------------------------------------------------------------------------ */

type StandardProps = {
  version: 1;
  vendor: string;
  validate: (value: unknown, options?: never) => unknown;
  jsonSchema?: {
    input?: (options: unknown) => unknown;
    output?: (options: unknown) => unknown;
  };
  types?: unknown;
};

/**
 * Advertise an object-root JSON Schema to the model while keeping the original
 * schema for runtime validation (e.g. a Zod discriminated union keeps its
 * per-operation required fields). Returns a fresh Standard Schema object; the
 * input schema is not mutated.
 */
export function objectRootSchema<S extends { "~standard": object }>(schema: S): S {
  const std = schema["~standard"] as StandardProps;
  const input = std.jsonSchema?.input;
  const output = std.jsonSchema?.output;
  if (typeof input !== "function" || typeof output !== "function") {
    throw new Error("objectRootSchema: schema has no JSON Schema emitter (use Zod 4 or a Standard JSON Schema)");
  }
  const emit = (fn: (o: unknown) => unknown) => (options: unknown) => {
    const result = normalizeToolInputSchema(fn(options));
    if (!result.ok) throw new Error(`objectRootSchema: ${result.reason}`);
    return result.schema;
  };
  const wrapped = {
    "~standard": {
      version: std.version,
      vendor: std.vendor,
      validate: (value: unknown, options?: never) => std.validate(value, options),
      jsonSchema: { input: emit(input), output: emit(output) },
      ...(std.types !== undefined ? { types: std.types } : {}),
    },
  };
  return wrapped as unknown as S;
}

/* ------------------------------------------------------------------------ */
/* Layer 2: provider-boundary middleware.                                     */
/* ------------------------------------------------------------------------ */

type ToolLike = { type?: string; name?: string; inputSchema?: unknown };

const warned = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Normalize (or drop) function tools in a model call's params. Exported for tests. */
export function guardToolParams<P extends { tools?: unknown; toolChoice?: unknown }>(params: P): P {
  const tools = params.tools as ToolLike[] | undefined;
  if (!Array.isArray(tools) || tools.length === 0) return params;

  let touched = false;
  const dropped = new Set<string>();
  const next: ToolLike[] = [];
  for (const tool of tools) {
    if (!isRecord(tool) || tool.type !== "function") {
      next.push(tool);
      continue;
    }
    const name = typeof tool.name === "string" ? tool.name : "(unnamed)";
    const result = normalizeToolInputSchema(tool.inputSchema);
    if (!result.ok) {
      touched = true;
      dropped.add(name);
      warnOnce(`drop:${name}`, `[mstrmnd] tool-schema-guard: dropping tool "${name}" for this model call: ${result.reason}`);
      continue;
    }
    if (result.changed) {
      touched = true;
      warnOnce(`fix:${name}`, `[mstrmnd] tool-schema-guard: normalized input schema for tool "${name}": ${result.reason}`);
      next.push({ ...tool, inputSchema: result.schema });
    } else {
      next.push(tool);
    }
  }
  if (!touched) return params;

  let toolChoice = params.toolChoice;
  if (isRecord(toolChoice) && toolChoice.type === "tool" && dropped.has(String(toolChoice.toolName))) {
    toolChoice = { type: "auto" };
  }
  return { ...params, tools: next, toolChoice };
}

export const toolSchemaGuardMiddleware: LanguageModelMiddleware = {
  transformParams: async ({ params }) => guardToolParams(params),
};

/** Wrap a provider model so every call passes through the tool schema guard. */
export function withToolSchemaGuard(model: LanguageModel): LanguageModel {
  if (typeof model === "string") return model;
  return wrapLanguageModel({
    model: model as Parameters<typeof wrapLanguageModel>[0]["model"],
    middleware: toolSchemaGuardMiddleware,
  });
}
