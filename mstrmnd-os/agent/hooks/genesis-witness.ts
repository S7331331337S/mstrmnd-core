import { defineHook } from "eve/hooks";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SignedGenesis } from "@mstrmnd/genesis";

function loadPublicGenesis(): SignedGenesis | null {
  const path = join(process.cwd(), "agent", "genesis.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SignedGenesis;
  } catch {
    return null;
  }
}

function witnessUrl(): string {
  return (
    process.env.MSTRMND_GENESIS_WITNESS_URL ??
    "http://127.0.0.1:3000/api/genesis/ingest"
  );
}

function witnessToken(): string {
  return (
    process.env.MSTRMND_WITNESS_SECRET ||
    process.env.AUTH_SECRET ||
    "dev-insecure-secret-change-me"
  );
}

async function emit(
  eventType: string,
  event: { data?: unknown; meta?: { id?: string; sessionId?: string } },
  ctx: {
    session?: {
      id?: string;
      auth?: { current?: { principalId?: string } | null };
    };
  },
) {
  const genesis = loadPublicGenesis();
  if (!genesis) return;
  try {
    await fetch(witnessUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${witnessToken()}`,
      },
      body: JSON.stringify({
        agentId: genesis.agentId,
        eventType,
        sessionId: ctx.session?.id ?? event.meta?.sessionId,
        runId: ctx.session?.id,
        payload: event.data ?? event,
        actor: {
          agentId: genesis.agentId,
          humanSubject: ctx.session?.auth?.current?.principalId,
        },
        runtime: { framework: "eve" },
      }),
    });
  } catch (err) {
    console.error("genesis witness emit failed:", err);
  }
}

/**
 * Observe-only Eve hook. Posts unsigned observations to the external witness.
 * Private keys never enter this process.
 */
export default defineHook({
  events: {
    async "message.completed"(event, ctx) {
      await emit("model.completed", event, ctx);
    },
    async "action.result"(event, ctx) {
      await emit("tool.execution.completed", event, ctx);
    },
    async "approval.settled"(event, ctx) {
      await emit("tool.approved", event, ctx);
    },
    async "subagent.called"(event, ctx) {
      await emit("subagent.spawned", event, ctx);
    },
  },
});
