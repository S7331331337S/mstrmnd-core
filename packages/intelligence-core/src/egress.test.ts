import assert from "node:assert/strict";
import test from "node:test";
import {
  EgressConfigError,
  loadEgressConfig,
  parseEgressAllowlist,
  resetProcessModelBudget,
} from "./egress";
import { createRuntime } from "./runtime";

const ENV_KEYS = [
  "NODE_ENV",
  "MSTRMND_ALLOW_ECHO",
  "MSTRMND_MODEL_PROVIDER",
  "MSTRMND_MODEL_BASE_URL",
  "MSTRMND_MODEL_API_KEY",
  "MSTRMND_MODEL_NAME",
  "MSTRMND_MODEL_CALL_BUDGET_USD",
  "MSTRMND_EGRESS_ALLOWLIST",
  "MSTRMND_MODEL_PROCESS_BUDGET_USD",
] as const;

type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>;

/** Gateway-shaped openai-compatible env, plus overrides. fetch is stubbed and counted. */
async function withGateway(
  env: Env,
  fn: (ctx: { fetchCalls: () => number; logs: string[] }) => Promise<void>
) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const logs: string[] = [];
  let calls = 0;
  try {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, {
      NODE_ENV: "test",
      MSTRMND_MODEL_PROVIDER: "openai-compatible",
      MSTRMND_MODEL_BASE_URL: "https://ai-gateway.vercel.sh/v1",
      MSTRMND_MODEL_API_KEY: "sk-test-secret-value",
      MSTRMND_MODEL_CALL_BUDGET_USD: "0.1",
      ...env,
    });
    resetProcessModelBudget();
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ choices: [{ message: { content: "[]" } }] }), { status: 200 });
    }) as typeof fetch;
    console.error = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    await fn({ fetchCalls: () => calls, logs });
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    resetProcessModelBudget();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

async function runGoal() {
  const runtime = await createRuntime({ allowMissingVault: true });
  const orch = runtime.createOrchestrator({ dryRun: true });
  const run = await orch.dispatch(orch.createRun("operator-agent", "egress test"));
  return { runtime, orch, run };
}

test("unset allowlist: empty boundary allowlists, and a Gateway call is denied before any request", () =>
  withGateway({}, async ({ fetchCalls, logs }) => {
    assert.deepEqual(parseEgressAllowlist(undefined), []);
    assert.deepEqual(parseEgressAllowlist("   "), []);
    const cfg = loadEgressConfig();
    assert.deepEqual(cfg.networkAllowlist, []);
    assert.deepEqual(cfg.credentialAllowlist, []);

    const { orch, run } = await runGoal();
    assert.deepEqual(orch.getBoundary().networkAllowlist, []);
    assert.deepEqual(orch.getBoundary().credentialAllowlist, []);
    assert.equal(fetchCalls(), 0);
    assert.equal(run.status, "failed");
    assert.ok(logs.some((l) => /\[egress-denied\] host=ai-gateway\.vercel\.sh reason=.*network denied/.test(l)), logs.join("\n"));
  }));

test("allowlist set to ai-gateway.vercel.sh allows that host (and only binds model-api-key)", () =>
  withGateway(
    { MSTRMND_EGRESS_ALLOWLIST: "ai-gateway.vercel.sh", MSTRMND_MODEL_PROCESS_BUDGET_USD: "5" },
    async ({ fetchCalls, logs }) => {
      const { orch } = await runGoal();
      assert.deepEqual(orch.getBoundary().networkAllowlist, ["ai-gateway.vercel.sh"]);
      assert.deepEqual(orch.getBoundary().credentialAllowlist, ["model-api-key"]);
      assert.deepEqual(orch.getBoundary().mcpAllowlist, ["mstrmnd"]);
      assert.ok(fetchCalls() >= 1);
      assert.equal(logs.filter((l) => l.includes("[egress-denied]")).length, 0, logs.join("\n"));
    }
  ));

test("normalizes case and whitespace; de-duplicates", () => {
  assert.deepEqual(parseEgressAllowlist("  AI-Gateway.Vercel.SH , api.Example.com,ai-gateway.vercel.sh "), [
    "ai-gateway.vercel.sh",
    "api.example.com",
  ]);
});

test("off-list host is denied and logged (host + reason, no secrets)", () =>
  withGateway(
    {
      MSTRMND_EGRESS_ALLOWLIST: "ai-gateway.vercel.sh",
      MSTRMND_MODEL_PROCESS_BUDGET_USD: "5",
      MSTRMND_MODEL_BASE_URL: "https://evil.example/v1/path?token=abc",
    },
    async ({ fetchCalls, logs }) => {
      const { run } = await runGoal();
      assert.equal(fetchCalls(), 0);
      assert.equal(run.status, "failed");
      const denied = logs.filter((l) => l.includes("[egress-denied]"));
      assert.ok(denied.length >= 1);
      assert.match(denied[0], /host=evil\.example reason=.*network denied/);
      for (const l of logs) {
        assert.ok(!l.includes("sk-test-secret-value"), "api key leaked into logs");
        assert.ok(!l.includes("token=abc"), "query string leaked into logs");
      }
    }
  ));

test("wildcards, schemes, paths, ports and empty entries are rejected at load", () => {
  for (const bad of [
    "*",
    "*.vercel.sh",
    "ai-gateway.*.sh",
    "https://ai-gateway.vercel.sh",
    "ai-gateway.vercel.sh/v1",
    "ai-gateway.vercel.sh:443",
    "ai-gateway.vercel.sh:*",
    "ai-gateway.vercel.sh,,api.example.com",
    "ai-gateway.vercel.sh,",
    "10.0.0.1",
    "bad host",
  ]) {
    assert.throws(() => parseEgressAllowlist(bad), EgressConfigError, `should reject ${JSON.stringify(bad)}`);
  }
  assert.throws(() => parseEgressAllowlist("*.vercel.sh"), /wildcard/);
  assert.throws(() => parseEgressAllowlist("a.example,,b.example"), /empty/);
});

test("allowlist without a process budget fails closed at load; bad budget is rejected", () => {
  assert.throws(
    () => loadEgressConfig({ MSTRMND_EGRESS_ALLOWLIST: "ai-gateway.vercel.sh" }),
    /MSTRMND_MODEL_PROCESS_BUDGET_USD is required/
  );
  assert.throws(
    () => loadEgressConfig({ MSTRMND_EGRESS_ALLOWLIST: "ai-gateway.vercel.sh", MSTRMND_MODEL_PROCESS_BUDGET_USD: "lots" }),
    EgressConfigError
  );
  assert.throws(
    () => loadEgressConfig({ MSTRMND_EGRESS_ALLOWLIST: "ai-gateway.vercel.sh", MSTRMND_MODEL_PROCESS_BUDGET_USD: "-1" }),
    EgressConfigError
  );
});

test("runtime wiring: an invalid allowlist fails createRuntime (eager) and, when lazy, only the model path", () =>
  withGateway({ MSTRMND_EGRESS_ALLOWLIST: "*.vercel.sh" }, async () => {
    await assert.rejects(() => createRuntime({ allowMissingVault: true }), /MSTRMND_EGRESS_ALLOWLIST.*wildcard/);
    const lazy = await createRuntime({ allowMissingVault: true, lazyProvider: true });
    assert.throws(() => lazy.createOrchestrator({ dryRun: true }), /MSTRMND_EGRESS_ALLOWLIST.*wildcard/);
  }));

test("process budget exhaustion denies further calls and logs it", () =>
  withGateway(
    {
      MSTRMND_EGRESS_ALLOWLIST: "ai-gateway.vercel.sh",
      MSTRMND_MODEL_PROCESS_BUDGET_USD: "0.15", // per-call reservation is 0.1: one call fits, the second does not
    },
    async ({ fetchCalls, logs }) => {
      const { run } = await runGoal();
      assert.equal(fetchCalls(), 1);
      assert.equal(run.status, "failed");
      assert.ok(
        logs.some((l) => /\[egress-denied\] host=ai-gateway\.vercel\.sh reason=process model budget exhausted/.test(l)),
        logs.join("\n")
      );
      // budget is process-wide: a second runtime/orchestrator is also denied
      const before = fetchCalls();
      await runGoal();
      assert.equal(fetchCalls(), before);
    }
  ));

test("zero process budget denies every call", () =>
  withGateway(
    { MSTRMND_EGRESS_ALLOWLIST: "ai-gateway.vercel.sh", MSTRMND_MODEL_PROCESS_BUDGET_USD: "0" },
    async ({ fetchCalls, logs }) => {
      await runGoal();
      assert.equal(fetchCalls(), 0);
      assert.ok(logs.some((l) => l.includes("process model budget exhausted")));
    }
  ));
