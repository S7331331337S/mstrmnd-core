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
