import { NextRequest, NextResponse } from "next/server";
import { thirdMind } from "@/agent/lib/third-mind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const store = thirdMind();
  const q = req.nextUrl.searchParams.get("q");
  if (q && q.trim().length > 0) {
    const hits = await store.search(q, 25);
    return NextResponse.json({ mode: "search", query: q, hits });
  }
  const observations = await store.list(50);
  return NextResponse.json({ mode: "list", observations });
}

export async function POST(req: NextRequest) {
  let body: { key?: string; content?: string; tags?: string[]; agent?: string };
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
    key: body.key,
    content: body.content,
    tags: body.tags ?? [],
    agent: body.agent ?? "operator",
  });
  return NextResponse.json({ ok: true, observation });
}
