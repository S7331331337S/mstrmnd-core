import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/users";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const user = await authenticate(body.email ?? "", body.password ?? "");
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }
  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    workspaceId: user.workspaceId,
  });
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
