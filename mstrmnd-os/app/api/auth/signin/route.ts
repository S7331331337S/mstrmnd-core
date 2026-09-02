import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/users";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { corsPreflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; client?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: "invalid JSON body" }, { status: 400 }));
  }
  const user = await authenticate(body.email ?? "", body.password ?? "");
  if (!user) {
    return withCors(
      NextResponse.json({ error: "Invalid email or password." }, { status: 401 }),
    );
  }
  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    workspaceId: user.workspaceId,
  });
  const forBoard =
    body.client === "board" || req.headers.get("x-mstrmnd-client") === "board";
  const res = withCors(
    NextResponse.json(forBoard ? { ok: true, user, token } : { ok: true, user }),
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
