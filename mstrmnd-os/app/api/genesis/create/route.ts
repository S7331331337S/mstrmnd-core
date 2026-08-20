import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { genesisService } from "@/lib/genesis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    purpose?: string;
    values?: string[] | string;
    boundaries?: string[] | string;
    controllerType?: string;
    controllerId?: string;
    modelPolicy?: string;
    approvalPolicy?: string;
    bindSubagents?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const split = (v: string[] | string | undefined, fallback: string[]) => {
    if (Array.isArray(v)) return v.map((s) => s.trim()).filter(Boolean);
    if (typeof v === "string")
      return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    return fallback;
  };

  const records = await genesisService().issue(session.workspaceId, {
    name: body.name?.trim() || "Maestro",
    purpose:
      body.purpose?.trim() || "Coordinate MSTRMND operations",
    values: split(body.values, ["accuracy", "initiative", "traceability"]),
    boundaries: split(body.boundaries, ["no unapproved financial transactions"]),
    controllerType: body.controllerType?.trim() || "organization",
    controllerId: body.controllerId?.trim() || "mstrmnd.ai",
    modelPolicy: body.modelPolicy?.trim() || "gateway/model-agnostic",
    approvalPolicy: body.approvalPolicy?.trim() || "risk-tiered",
    bindSubagents: body.bindSubagents !== false,
  });
  return NextResponse.json({ ok: true, agents: records });
}
