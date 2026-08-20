import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { genesisService } from "@/lib/genesis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const agents = await genesisService().listAgents(session.workspaceId);
  return NextResponse.json({ agents });
}
