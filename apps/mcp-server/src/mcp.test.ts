import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "./mcp";

const KEYS = ["MSTRMND_MODEL_PROVIDER", "MSTRMND_ALLOW_ECHO", "NODE_ENV"] as const;

async function withEnv(env: Partial<Record<(typeof KEYS)[number], string>>, fn: (client: Client) => Promise<void>) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  try {
    const server = await createMcpServer(); // must not throw with no provider
    await Promise.all([server.connect(serverT), client.connect(clientT)]);
    await fn(client);
    await client.close();
    await server.close();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

function text(result: unknown): string {
  const c = (result as { content: Array<{ type: string; text?: string }> }).content;
  return c.map((x) => x.text ?? "").join("");
}

test("no provider set (NODE_ENV unset): createMcpServer works and non-model tools still answer", () =>
  withEnv({}, async (client) => {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    assert.ok(tools.includes("run_agent"));

    const agents = await client.callTool({ name: "list_agents", arguments: {} });
    assert.notEqual(agents.isError, true);
    assert.match(text(agents), /operator-agent/);

    const ctx = await client.callTool({ name: "get_context", arguments: {} });
    assert.notEqual(ctx.isError, true);

    const search = await client.callTool({ name: "search_memory", arguments: { query: "mstrmnd" } });
    assert.notEqual(search.isError, true);

    const ws = await client.callTool({ name: "list_workspace", arguments: {} });
    assert.notEqual(ws.isError, true);
  }));

test("no provider set: run_agent returns an isError tool result naming MSTRMND_MODEL_PROVIDER (no crash)", () =>
  withEnv({}, async (client) => {
    const res = await client.callTool({ name: "run_agent", arguments: { goal: "x", dryRun: true } });
    assert.equal(res.isError, true);
    assert.match(text(res), /MSTRMND_MODEL_PROVIDER/);
    // server still healthy afterwards
    const after = await client.callTool({ name: "list_agents", arguments: {} });
    assert.notEqual(after.isError, true);
  }));

test("echo under NODE_ENV=test: run_agent still works when a provider is explicitly selected", () =>
  withEnv({ NODE_ENV: "test", MSTRMND_MODEL_PROVIDER: "echo" }, async (client) => {
    const res = await client.callTool({ name: "run_agent", arguments: { goal: "hello", dryRun: true } });
    assert.notEqual(res.isError, true);
    assert.match(text(res), /"status"/);
  }));
