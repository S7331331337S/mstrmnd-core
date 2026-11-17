import { test } from "node:test";
import assert from "node:assert/strict";
import { EchoProvider, isEchoAllowed, resolveModelProvider } from "./model-provider";

const KEYS = ["NODE_ENV", "VERCEL_ENV", "MSTRMND_ALLOW_ECHO", "MSTRMND_MODEL_PROVIDER"] as const;

/** Run `fn` with exactly the given env (all guard-relevant keys cleared first), then restore. */
async function withEnv(env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => unknown | Promise<unknown>) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  try {
    for (const k of KEYS) delete process.env[k];
    Object.assign(process.env, env);
    await fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const NOT_ALLOWED = /allowed only when NODE_ENV=test or MSTRMND_ALLOW_ECHO=1/;

test("NODE_ENV unset: echo fails closed and there is no default provider", () =>
  withEnv({}, () => {
    assert.equal(isEchoAllowed(), false);
    assert.throws(() => resolveModelProvider(), /must be configured explicitly/);
    assert.throws(() => resolveModelProvider("echo"), NOT_ALLOWED);
    assert.throws(() => resolveModelProvider(""), /must be configured explicitly/);
  }));

test("NODE_ENV=production: echo fails closed, no default", () =>
  withEnv({ NODE_ENV: "production" }, () => {
    assert.throws(() => resolveModelProvider(), /must be configured explicitly/);
    assert.throws(() => resolveModelProvider("echo"), NOT_ALLOWED);
  }));

test("VERCEL_ENV=preview fails closed for echo", () =>
  withEnv({ VERCEL_ENV: "preview" }, () => {
    assert.equal(isEchoAllowed(), false);
    assert.throws(() => resolveModelProvider("echo"), NOT_ALLOWED);
    assert.throws(() => resolveModelProvider(), /must be configured explicitly/);
  }));

test("VERCEL_ENV=production fails closed for echo", () =>
  withEnv({ VERCEL_ENV: "production" }, () => {
    assert.throws(() => resolveModelProvider("echo"), NOT_ALLOWED);
  }));

test("MSTRMND_ALLOW_ECHO=1 allows echo (when selected explicitly)", () =>
  withEnv({ MSTRMND_ALLOW_ECHO: "1", MSTRMND_MODEL_PROVIDER: "echo" }, async () => {
    const provider = resolveModelProvider();
    assert.ok(provider instanceof EchoProvider);
    assert.equal(await provider.complete([{ role: "user", content: "hello" }]), "[echo] hello");
  }));

test("MSTRMND_ALLOW_ECHO must be exactly '1'", () =>
  withEnv({ MSTRMND_ALLOW_ECHO: "true" }, () => {
    assert.equal(isEchoAllowed(), false);
    assert.throws(() => resolveModelProvider("echo"), NOT_ALLOWED);
  }));

test("NODE_ENV=test allows explicit echo but still has no default", () =>
  withEnv({ NODE_ENV: "test" }, async () => {
    assert.throws(() => resolveModelProvider(), /must be configured explicitly/);
    const provider = resolveModelProvider("echo");
    assert.ok(provider instanceof EchoProvider);
    assert.equal(await provider.complete([{ role: "user", content: "hello" }]), "[echo] hello");
  }));

// --- openai-compatible: everything comes from env, nothing hardcoded ---------

const OC_KEYS = [
  "MSTRMND_MODEL_BASE_URL",
  "MSTRMND_MODEL_API_KEY",
  "OPENAI_API_KEY",
  "MSTRMND_MODEL_NAME",
  "MSTRMND_MODEL_ORG",
  "MSTRMND_MODEL_CALL_BUDGET_USD",
] as const;

async function withOcEnv(env: Partial<Record<(typeof OC_KEYS)[number], string>>, fn: () => unknown | Promise<unknown>) {
  const saved = Object.fromEntries(OC_KEYS.map((k) => [k, process.env[k]]));
  try {
    for (const k of OC_KEYS) delete process.env[k];
    Object.assign(process.env, env);
    await fn();
  } finally {
    for (const k of OC_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("openai-compatible reads base URL, key and model id from env (Gateway provider/model id passes through untouched)", () =>
  withOcEnv(
    {
      MSTRMND_MODEL_BASE_URL: "https://gateway.example.test/v1/",
      MSTRMND_MODEL_API_KEY: "  test-key-123  ",
      MSTRMND_MODEL_NAME: "anthropic/claude-sonnet-4.5",
    },
    async () => {
      const realFetch = globalThis.fetch;
      let seen: { url: string; auth: string | null; body: { model: string } } | undefined;
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        seen = {
          url: String(url),
          auth: new Headers(init?.headers).get("authorization"),
          body: JSON.parse(String(init?.body)),
        };
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
      }) as typeof fetch;
      try {
        const provider = resolveModelProvider("openai-compatible");
        assert.equal(provider.id, "openai-compatible");
        assert.deepEqual(provider.policy?.networkDestinations, ["https://gateway.example.test/v1"]);
        assert.equal(await provider.complete([{ role: "user", content: "hi" }]), "ok");
        assert.equal(seen?.url, "https://gateway.example.test/v1/chat/completions");
        assert.equal(seen?.auth, "Bearer test-key-123");
        assert.equal(seen?.body.model, "anthropic/claude-sonnet-4.5");
      } finally {
        globalThis.fetch = realFetch;
      }
    }
  ));

test("openai-compatible fails closed without a base URL (no api.openai.com fallback)", () =>
  withOcEnv({ MSTRMND_MODEL_API_KEY: "test-key" }, () => {
    assert.throws(() => resolveModelProvider("openai-compatible"), /requires MSTRMND_MODEL_BASE_URL/);
  }));

test("openai-compatible fails closed without an API key", () =>
  withOcEnv({ MSTRMND_MODEL_BASE_URL: "https://gateway.example.test/v1" }, () => {
    assert.throws(() => resolveModelProvider("openai-compatible"), /requires MSTRMND_MODEL_API_KEY or OPENAI_API_KEY/);
  }));
