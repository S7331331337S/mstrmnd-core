import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHostServer, listen } from "./http";

const REPO = join(import.meta.dirname, "../../..");

async function withHost(
  fn: (base: string) => Promise<void>
): Promise<void> {
  const vault = await mkdtemp(join(tmpdir(), "mstrmnd-host-"));
  const host = await createHostServer({ repoRoot: REPO, vaultPath: vault });
  const port = await listen(host, 0, "127.0.0.1");
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await host.close();
  }
}

test("host health, adk, context, agents, and dry-run", async () => {
  await withHost(async (base) => {
    const health = await (await fetch(`${base}/health`)).json() as {
      ok: boolean;
      transports: string[];
      provider: string;
    };
    assert.equal(health.ok, true);
    assert.deepEqual(health.transports, ["api", "mcp", "adk", "cli"]);
    assert.equal(health.provider, "echo");

    const ready = await fetch(`${base}/ready`);
    assert.equal(ready.status, 200);

    const adk = await (await fetch(`${base}/adk`)).json() as {
      transports: { api: string; mcpHttp: string };
      agents: Array<{ id: string }>;
      tools: Array<{ id: string }>;
    };
    assert.ok(adk.transports.api.endsWith("/v1"));
    assert.ok(adk.transports.mcpHttp.endsWith("/mcp"));
    assert.ok(adk.agents.some((a) => a.id === "operator-agent"));
    assert.ok(adk.tools.some((t) => t.id === "run_agent"));

    const card = await (await fetch(`${base}/.well-known/agent.json`)).json() as {
      name: string;
      skills: Array<{ id: string }>;
    };
    assert.equal(card.name, "MSTRMND");
    assert.ok(card.skills.length >= 8);

    const ctx = await (await fetch(`${base}/v1/context`)).json() as {
      company: { name: string };
      doctrineRef: string | null;
    };
    assert.ok(ctx.company.name);

    const agents = await (await fetch(`${base}/v1/agents`)).json() as {
      agents: Array<{ id: string }>;
    };
    assert.ok(agents.agents.some((a) => a.id === "workspace-scout"));

    const runRes = await fetch(`${base}/v1/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: "Summarize Operator Zero", dryRun: true }),
    });
    assert.equal(runRes.status, 200);
    const run = await runRes.json() as { status: string; steps: number };
    assert.equal(run.status, "succeeded");
    assert.ok(run.steps >= 1);

    const deny = await fetch(`${base}/v1/workspace/drafts/nope/approve`, {
      method: "POST",
    });
    assert.equal(deny.status, 403);
  });
});

test("host stages drafts and refuses path escape", async () => {
  await withHost(async (base) => {
    const mounts = await (await fetch(`${base}/v1/workspace`)).json() as {
      mountId: string;
    };
    const staged = await fetch(`${base}/v1/workspace/drafts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mountId: mounts.mountId,
        path: "note.md",
        content: "# staged",
      }),
    });
    assert.equal(staged.status, 201);
    const draft = await staged.json() as { status: string; draftId: string };
    assert.equal(draft.status, "awaiting_approval");
    assert.ok(draft.draftId);

    const escape = await fetch(`${base}/v1/workspace/file?path=../secret`);
    assert.equal(escape.status, 400);
  });
});
