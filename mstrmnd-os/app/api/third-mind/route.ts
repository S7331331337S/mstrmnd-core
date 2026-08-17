import { NextRequest, NextResponse } from "next/server";
import { thirdMind } from "@/agent/lib/third-mind";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const store = thirdMind();
  const q = req.nextUrl.searchParams.get("q");
  if (q && q.trim().length > 0) {
    const hits = await store.search(session.workspaceId, q, 25);
    return NextResponse.json({ mode: "search", query: q, hits });
  }
  const observations = await store.list(session.workspaceId, 50);
  return NextResponse.json({ mode: "list", observations });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { key?: string; content?: string; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.key?.trim() || !body.content?.trim()) {
    return NextResponse.json(
      { error: "key and content are required" },
      { status: 400 },
    );
  }
  const observation = await thirdMind().write({
    scope: session.workspaceId,
    key: body.key,
    content: body.content,
    tags: body.tags ?? [],
    agent: session.name || "operator",
  });
  return NextResponse.json({ ok: true, observation });
}
