/**
 * Regression tests for the P0 "Invalid schema for function 'vgpu_docs' ...
 * got 'type: \"None\"'" outage on core.mstrmnd.dev.
 *
 * Run: pnpm test:tools  (tsx --test tests/*.test.ts)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, jsonSchema, tool } from "ai";
import {
  guardToolParams,
  normalizeToolInputSchema,
  withToolSchemaGuard,
} from "../agent/lib/tool-schema";

const ROOT = path.resolve(import.meta.dirname, "..");

type Json = Record<string, unknown>;

/* --------------------------- normalizer unit tests --------------------------- */

test("missing schema becomes an empty object schema", () => {
  for (const input of [undefined, null]) {
    const r = normalizeToolInputSchema(input);
    assert.ok(r.ok);
    assert.deepEqual(r.schema, { type: "object", properties: {} });
  }
});

test('type "None" / null / "null" becomes an empty object schema', () => {
  for (const input of [{ type: "None" }, { type: null }, { type: "null" }]) {
    const r = normalizeToolInputSchema(input);
    assert.ok(r.ok, JSON.stringify(input));
    assert.deepEqual(r.schema, { type: "object", properties: {} });
  }
});

test("empty {} becomes an empty object schema", () => {
  const r = normalizeToolInputSchema({});
  assert.ok(r.ok);
  assert.deepEqual(r.schema, { type: "object", properties: {} });
});

test("valid object schema is returned untouched (same reference)", () => {
  const schema = {
    type: "object",
    properties: { q: { type: "string" } },
    required: ["q"],
    additionalProperties: false,
  };
  const r = normalizeToolInputSchema(schema);
  assert.ok(r.ok);
  assert.equal(r.changed, false);
  assert.equal(r.schema, schema);
});

test("root oneOf of objects is flattened; discriminator becomes a required enum", () => {
  const r = normalizeToolInputSchema({
    oneOf: [
      { type: "object", properties: { operation: { type: "string", const: "search" }, query: { type: "string" } }, required: ["operation", "query"], additionalProperties: false },
      { type: "object", properties: { operation: { type: "string", const: "read" }, target: { type: "string" } }, required: ["operation", "target"], additionalProperties: false },
    ],
  });
  assert.ok(r.ok);
  assert.equal(r.schema.type, "object");
  assert.equal(r.schema.oneOf, undefined);
  const props = r.schema.properties as Json;
  assert.deepEqual(props.operation, { type: "string", enum: ["search", "read"] });
  assert.deepEqual(Object.keys(props).sort(), ["operation", "query", "target"]);
  assert.deepEqual(r.schema.required, ["operation"]);
  assert.equal(r.schema.additionalProperties, false);
});

test("unrecoverable roots are rejected", () => {
  for (const input of [
    { type: "string" },
    { type: "array", items: { type: "string" } },
    { anyOf: [{ type: "object", properties: {} }, { type: "string" }] },
    "not a schema",
  ]) {
    assert.equal(normalizeToolInputSchema(input).ok, false, JSON.stringify(input));
  }
});

/* ------------------------ provider-boundary middleware ----------------------- */

test("guardToolParams normalizes bad tools, drops unrecoverable ones, keeps good ones", () => {
  const good = { type: "function", name: "good", inputSchema: { type: "object", properties: {} } };
  const params = {
    tools: [
      good,
      { type: "function", name: "none", inputSchema: { type: "None" } },
      { type: "function", name: "missing" },
      { type: "function", name: "prim", inputSchema: { type: "string" } },
      { type: "provider", id: "openai.web_search", name: "web_search", args: {} },
    ],
    toolChoice: { type: "tool", toolName: "prim" },
  };
  const out = guardToolParams(params) as typeof params;
  const names = out.tools.map((t) => t.name);
  assert.deepEqual(names, ["good", "none", "missing", "web_search"]);
  assert.equal(out.tools[0], good);
  assert.deepEqual((out.tools[1] as Json).inputSchema, { type: "object", properties: {} });
  assert.deepEqual(out.toolChoice, { type: "auto" });
});

test("OpenAI request body only carries object-root tool parameters (mocked fetch)", async () => {
  let body: Json | undefined;
  const openai = createOpenAI({
    apiKey: "test-key",
    fetch: async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ error: { message: "stop after capture" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const model = withToolSchemaGuard(openai("gpt-4o"));
  const vgpuLike = jsonSchema({
    oneOf: [
      { type: "object", properties: { operation: { type: "string", const: "search" }, query: { type: "string" } }, required: ["operation", "query"], additionalProperties: false },
      { type: "object", properties: { operation: { type: "string", const: "read" }, target: { type: "string" } }, required: ["operation", "target"], additionalProperties: false },
    ],
  } as never);

  await generateText({
    model,
    prompt: "test",
    maxRetries: 0,
    tools: {
      vgpu_docs: tool({ description: "union root", inputSchema: vgpuLike }),
      empty: tool({ description: "empty", inputSchema: jsonSchema({} as never) }),
      none: tool({ description: "None", inputSchema: jsonSchema({ type: "None" } as never) }),
      prim: tool({ description: "primitive root", inputSchema: jsonSchema({ type: "string" } as never) }),
      ok: tool({ description: "valid", inputSchema: jsonSchema({ type: "object", properties: { q: { type: "string" } }, required: ["q"] }) }),
    },
  }).catch(() => undefined);

  assert.ok(body, "request was sent to the provider");
  const tools = body.tools as Json[];
  const byName = Object.fromEntries(tools.map((t) => [t.name ?? (t.function as Json)?.name, t]));
  assert.deepEqual(Object.keys(byName).sort(), ["empty", "none", "ok", "vgpu_docs"]);
  for (const t of tools) {
    const params = (t.parameters ?? (t.function as Json)?.parameters) as Json;
    assert.equal(params.type, "object", `tool ${String(t.name)} has object root`);
    assert.equal(params.oneOf, undefined);
    assert.equal(params.anyOf, undefined);
  }
});

/* ---------------- authored tools through eve's real serializer ---------------- */

function toolFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "tools") {
          for (const f of readdirSync(full)) if (f.endsWith(".ts")) out.push(path.join(full, f));
        } else walk(full);
      }
    }
  };
  walk(path.join(ROOT, "agent"));
  return out.sort();
}

async function eveSchema(): Promise<{
  serializeModelInputSchema: (s: unknown) => Json | null | undefined;
  toInputSchema: (s: unknown) => unknown;
}> {
  // eve does not export its serializer publicly; load the exact module the
  // compiler uses (`modelInputSchemaOf` = serializeModelInputSchema(toInputSchema(..))).
  const file = path.join(ROOT, "node_modules/eve/dist/src/tools/schema.js");
  assert.ok(existsSync(file), "eve tools/schema.js present");
  return import(pathToFileURL(file).href);
}

test("every authored tool serializes (via eve) to an object-root schema", async () => {
  const { serializeModelInputSchema, toInputSchema } = await eveSchema();
  const files = toolFiles();
  assert.ok(files.some((f) => f.endsWith("vgpu_docs.ts")));
  let checked = 0;
  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    const def = mod.default as { inputSchema?: unknown } | undefined;
    if (!def || def.inputSchema === undefined) continue; // disableTool() etc.
    const schema = serializeModelInputSchema(toInputSchema(def.inputSchema));
    const rel = path.relative(ROOT, file);
    assert.ok(schema, `${rel}: serialized schema`);
    assert.equal(schema.type, "object", `${rel}: root type is object`);
    assert.equal(schema.oneOf, undefined, `${rel}: no root oneOf`);
    assert.equal(schema.anyOf, undefined, `${rel}: no root anyOf`);
    checked++;
  }
  assert.ok(checked >= 7, `checked ${checked} tools`);
});

async function validate(file: string, value: unknown) {
  const mod = await import(pathToFileURL(path.join(ROOT, "agent/tools", file)).href);
  const std = (mod.default.inputSchema as { "~standard": { validate: (v: unknown) => unknown } })["~standard"];
  return (await std.validate(value)) as { value?: unknown; issues?: unknown[] };
}

test("vgpu_docs: advertised schema is flat, runtime validation keeps the union", async () => {
  const { serializeModelInputSchema, toInputSchema } = await eveSchema();
  const mod = await import(pathToFileURL(path.join(ROOT, "agent/tools/vgpu_docs.ts")).href);
  const schema = serializeModelInputSchema(toInputSchema(mod.default.inputSchema)) as Json;
  const op = (schema.properties as Json).operation as Json;
  assert.deepEqual(op.enum, ["search", "read", "resolve", "list", "grep", "symbols"]);
  assert.deepEqual(schema.required, ["operation"]);

  assert.equal((await validate("vgpu_docs.ts", { operation: "search", query: "pipeline" })).issues, undefined);
  assert.equal((await validate("vgpu_docs.ts", { operation: "read", target: "/guide/canvas" })).issues, undefined);
  assert.ok((await validate("vgpu_docs.ts", { operation: "search" })).issues?.length, "search needs query");
  assert.ok((await validate("vgpu_docs.ts", { operation: "delete", query: "x" })).issues?.length, "unknown op");
  assert.ok((await validate("vgpu_docs.ts", {})).issues?.length, "operation required");
});

test("vgpu_examples: advertised schema is flat, runtime validation keeps the union", async () => {
  const { serializeModelInputSchema, toInputSchema } = await eveSchema();
  const mod = await import(pathToFileURL(path.join(ROOT, "agent/tools/vgpu_examples.ts")).href);
  const schema = serializeModelInputSchema(toInputSchema(mod.default.inputSchema)) as Json;
  assert.equal(schema.type, "object");
  assert.deepEqual(((schema.properties as Json).operation as Json).enum, ["search", "show", "read"]);

  assert.equal((await validate("vgpu_examples.ts", { operation: "show", id: "hello-triangle" })).issues, undefined);
  assert.ok((await validate("vgpu_examples.ts", { operation: "show", id: "Bad ID!" })).issues?.length, "id regex");
  assert.ok((await validate("vgpu_examples.ts", { operation: "read", id: "hello-triangle" })).issues?.length, "read needs path");
});

test("safety net alone: a raw z.discriminatedUnion serialized by eve is fixed at the provider boundary", async () => {
  const { z } = await import("zod");
  const { serializeModelInputSchema, toInputSchema } = await eveSchema();
  const raw = z.discriminatedUnion("op", [
    z.object({ op: z.literal("a"), x: z.string() }),
    z.object({ op: z.literal("b"), y: z.number() }),
  ]);
  const serialized = serializeModelInputSchema(toInputSchema(raw)) as Json;
  assert.equal(serialized.type, undefined, "eve 1.0.2 emits an untyped root for unions (the bug)");
  assert.ok(Array.isArray(serialized.oneOf));
  const out = guardToolParams({ tools: [{ type: "function", name: "raw_union", inputSchema: serialized }] });
  const fixed = (out.tools as Json[])[0].inputSchema as Json;
  assert.equal(fixed.type, "object");
  assert.deepEqual(((fixed.properties as Json).op as Json).enum, ["a", "b"]);
});
