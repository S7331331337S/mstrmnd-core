import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";

/**
 * Gate the app: unauthenticated users are redirected to /sign-in. The eve
 * routes (/eve/*) are intentionally excluded — the eve channel enforces its
 * own auth against the same session cookie.
 */
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/api/auth", "/api/board", "/eve", "/field"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = readSessionCookie(req.headers.get("cookie"));
  const session = token ? await verifySession(token) : null;
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
