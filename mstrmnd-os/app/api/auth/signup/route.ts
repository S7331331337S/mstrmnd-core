import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/users";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  try {
    const user = await createUser({ email, name: body.name ?? "", password });
    const token = await signSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceId: user.workspaceId,
    });
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sign up failed" },
      { status: 409 },
    );
  }
}
