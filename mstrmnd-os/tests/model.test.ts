/**
 * Gateway routing tests for agent/lib/model.ts: model id, OIDC-vs-key auth,
 * and the MSTRMND_MODEL_FALLBACKS chain sent to Vercel AI Gateway.
 *
 * Run: pnpm test:tools  (tsx --test tests/*.test.ts)
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { generateText } from "ai";
import { gatewayFallbacks, resolveModel } from "../agent/lib/model";

const KEYS = [
  "MSTRMND_PROVIDER",
  "MSTRMND_MODEL",
  "MSTRMND_MODEL_FALLBACKS",
  "MSTRMND_MODEL_BASE_URL",
  "AI_GATEWAY_API_KEY",
  "AI_GATEWAY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "XAI_TOKEN",
  "PERPLEXITY_API_TOKEN",
] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const realFetch = globalThis.fetch;

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});

function clearEnv() {
  for (const k of KEYS) delete process.env[k];
}

/** Run one turn against a stubbed Gateway and return the captured request. */
async function capture() {
  let captured: { url: string; headers: Headers; body: Record<string, unknown> } | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = {
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? "{}")),
    };
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: "ok" }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  await generateText({ model: resolveModel(), prompt: "hi" });
  assert.ok(captured, "no request was sent");
  return captured;
}

test("gatewayFallbacks parses a comma list and ignores blanks", () => {
  clearEnv();
  assert.deepEqual(gatewayFallbacks(), []);
  process.env.MSTRMND_MODEL_FALLBACKS = " openai/gpt-5.4 , ,xai/grok-4.6 ";
  assert.deepEqual(gatewayFallbacks(), ["openai/gpt-5.4", "xai/grok-4.6"]);
});

test("MSTRMND_PROVIDER=gateway sends the primary model and fallback chain to AI Gateway", async () => {
  clearEnv();
  process.env.MSTRMND_PROVIDER = "gateway";
  process.env.MSTRMND_MODEL = "anthropic/claude-sonnet-5.5";
  process.env.MSTRMND_MODEL_FALLBACKS = "openai/gpt-5.4";
  process.env.AI_GATEWAY_API_KEY = "test-key";
  const req = await capture();
  assert.match(req.url, /ai-gateway\.vercel\.sh/);
  assert.equal(req.headers.get("ai-language-model-id"), "anthropic/claude-sonnet-5.5");
  assert.equal(req.headers.get("authorization"), "Bearer test-key");
  const opts = req.body.providerOptions as { gateway?: { models?: string[] } } | undefined;
  assert.deepEqual(opts?.gateway?.models, ["openai/gpt-5.4"]);
});

test("no fallbacks configured sends no gateway routing options", async () => {
  clearEnv();
  process.env.MSTRMND_PROVIDER = "gateway";
  process.env.MSTRMND_MODEL = "anthropic/claude-sonnet-5.5";
  process.env.AI_GATEWAY_API_KEY = "test-key";
  const req = await capture();
  const opts = req.body.providerOptions as { gateway?: { models?: string[] } } | undefined;
  assert.equal(opts?.gateway?.models, undefined);
});

test("a fallback equal to the primary model is dropped", async () => {
  clearEnv();
  process.env.MSTRMND_PROVIDER = "gateway";
  process.env.MSTRMND_MODEL = "openai/gpt-5.4";
  process.env.MSTRMND_MODEL_FALLBACKS = "openai/gpt-5.4";
  process.env.AI_GATEWAY_API_KEY = "test-key";
  const req = await capture();
  const opts = req.body.providerOptions as { gateway?: { models?: string[] } } | undefined;
  assert.equal(opts?.gateway?.models, undefined);
});
