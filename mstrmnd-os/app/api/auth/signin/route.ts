import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/users";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { corsPreflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return corsPreflight();
}

/** Native / Expo clients that cannot use the httpOnly cookie need the JWT in the JSON body. */
function wantsBearerToken(bodyClient: string | undefined, req: NextRequest): boolean {
  const header = req.headers.get("x-mstrmnd-client");
  const client = (bodyClient ?? header ?? "").toLowerCase();
  return client === "board" || client === "alliance";
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; client?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: "invalid JSON body" }, { status: 400 }));
  }
  let user;
  try {
    user = await authenticate(body.email ?? "", body.password ?? "");
  } catch (err) {
    const message = err instanceof Error ? err.message : "sign in failed";
    const missingDb = /DATABASE_URL/i.test(message);
    return withCors(
      NextResponse.json({ error: message }, { status: missingDb ? 503 : 500 }),
    );
  }
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
  const includeToken = wantsBearerToken(body.client, req);
  const res = withCors(
    NextResponse.json(includeToken ? { ok: true, user, token } : { ok: true, user }),
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
