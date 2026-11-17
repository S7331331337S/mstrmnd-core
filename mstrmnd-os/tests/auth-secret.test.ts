import { test } from "node:test";
import assert from "node:assert/strict";
import { DEV_FALLBACK_SECRET, resolveAuthSecret } from "../lib/session";

test("production without AUTH_SECRET throws", () => {
  assert.throws(() => resolveAuthSecret({ NODE_ENV: "production" }), /AUTH_SECRET/);
});

test("production with blank AUTH_SECRET throws", () => {
  assert.throws(() => resolveAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "  " }), /AUTH_SECRET/);
});

test("production with the dev fallback value throws", () => {
  assert.throws(
    () => resolveAuthSecret({ NODE_ENV: "production", AUTH_SECRET: DEV_FALLBACK_SECRET }),
    /AUTH_SECRET/,
  );
});

test("production with a real secret returns it", () => {
  assert.equal(resolveAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "a".repeat(64) }), "a".repeat(64));
});

test("development falls back for local use", () => {
  assert.equal(resolveAuthSecret({ NODE_ENV: "development" }), DEV_FALLBACK_SECRET);
  assert.equal(resolveAuthSecret({}), DEV_FALLBACK_SECRET);
});
