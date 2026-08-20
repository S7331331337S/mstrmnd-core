import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { genesisService } from "@/lib/genesis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { agentId?: string; sequence?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.agentId || body.sequence == null) {
    return NextResponse.json(
      { error: "agentId and sequence are required" },
      { status: 400 },
    );
  }
  try {
    const result = await genesisService().verify(body.agentId, Number(body.sequence));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "verify failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
