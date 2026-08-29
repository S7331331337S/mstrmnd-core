import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { activeProviderLabel, modelIdForHint, resolveModel, type ModelHint } from "@/agent/lib/model";
import { writeBoardAudit } from "@/lib/board-audit";
import { recordUse, usedToday } from "@/lib/board-budget";
import {
  dailyLimitFromEnv,
  decideBoardPolicy,
  maxPromptCharsFromEnv,
} from "@/lib/board-policy";
import { corsPreflight, withCors } from "@/lib/cors";
import { getSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompleteBody = {
  system?: string;
  messages?: { role?: string; content?: string }[];
  maxTokens?: number;
  hint?: ModelHint;
};

function promptChars(body: CompleteBody): number {
  const system = body.system ?? "";
  const messages = (body.messages ?? [])
    .map((m) => `${m.role ?? ""}:${m.content ?? ""}`)
    .join("\n");
  return system.length + messages.length;
}

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  let body: CompleteBody;
  try {
    body = (await req.json()) as CompleteBody;
  } catch {
    return withCors(NextResponse.json({ error: "invalid JSON body" }, { status: 400 }));
  }

  const chars = promptChars(body);
  const used = session ? await usedToday(session.workspaceId) : 0;
  const decision = decideBoardPolicy({
    hasSession: Boolean(session),
    usedToday: used,
    dailyLimit: dailyLimitFromEnv(),
    promptChars: chars,
    maxPromptChars: maxPromptCharsFromEnv(),
  });

  await writeBoardAudit({
    at: new Date().toISOString(),
    workspaceId: session?.workspaceId ?? "none",
    userId: session?.userId ?? "anon",
    action: "complete",
    allowed: decision.allow,
    reason: decision.allow ? undefined : decision.reason,
    hint: body.hint,
    provider: activeProviderLabel(),
    promptChars: chars,
  });

  if (!decision.allow) {
    return withCors(NextResponse.json({ error: decision.reason }, { status: decision.status }));
  }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));

  if (!body.system?.trim() || messages.length === 0) {
    return withCors(
      NextResponse.json({ error: "system and messages are required." }, { status: 400 }),
    );
  }

  await recordUse(session!.workspaceId);

  const result = streamText({
    model: resolveModel(modelIdForHint(body.hint)),
    system: body.system,
    messages,
    maxOutputTokens:
      typeof body.maxTokens === "number" && body.maxTokens > 0 ? body.maxTokens : 1024,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        for await (const text of result.textStream) {
          if (text) send({ type: "delta", text });
        }
        send({ type: "done" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The model stream failed.";
        send({ type: "error", error: { message } });
      } finally {
        controller.close();
      }
    },
  });

  const res = new NextResponse(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
  return withCors(res);
}
