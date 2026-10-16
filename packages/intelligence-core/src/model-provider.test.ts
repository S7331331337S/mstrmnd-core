import { test } from "node:test";
import assert from "node:assert/strict";
import { EchoProvider, resolveModelProvider } from "./model-provider";

test("production does not silently select EchoProvider", () => {
  const original = process.env.NODE_ENV;
  const configured = process.env.MSTRMND_MODEL_PROVIDER;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.MSTRMND_MODEL_PROVIDER;
    assert.throws(() => resolveModelProvider(), /must be configured explicitly/);
    assert.throws(() => resolveModelProvider("echo"), /cannot be used in production/);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
    if (configured === undefined) delete process.env.MSTRMND_MODEL_PROVIDER;
    else process.env.MSTRMND_MODEL_PROVIDER = configured;
  }
});

test("offline explicit echo remains available in test environments", async () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "test";
    const provider = resolveModelProvider("echo");
    assert.ok(provider instanceof EchoProvider);
    assert.equal(await provider.complete([{ role: "user", content: "hello" }]), "[echo] hello");
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
