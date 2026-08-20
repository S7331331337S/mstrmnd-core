import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { genesisService } from "@/lib/genesis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 200);
  const events = await genesisService().listEvents(agentId, limit);
  return NextResponse.json({ events });
}
