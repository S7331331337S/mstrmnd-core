import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { genesisService } from "@/lib/genesis-service";
import type { UnsignedObservation } from "@mstrmnd/genesis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function witnessSecret(): string {
  return (
    process.env.MSTRMND_WITNESS_SECRET ||
    process.env.AUTH_SECRET ||
    "dev-insecure-secret-change-me"
  );
}

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

export async function POST(req: NextRequest) {
  const token = bearer(req);
  const session = await getSession();
  const witnessOk = token === witnessSecret();
  if (!session && !witnessOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: UnsignedObservation;
  try {
    body = (await req.json()) as UnsignedObservation;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body?.agentId || !body?.eventType) {
    return NextResponse.json(
      { error: "agentId and eventType are required" },
      { status: 400 },
    );
  }
  if (session && !body.actor) {
    body.actor = {
      agentId: body.agentId,
      humanSubject: session.userId,
    };
  }

  try {
    const event = await genesisService().ingest(body, {
      workspaceId: session?.workspaceId,
    });
    return NextResponse.json({ ok: true, event });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
