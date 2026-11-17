import { NextRequest, NextResponse } from "next/server";
import { isWorkflowPath } from "@/lib/proxy-paths";
import { readSessionCookie, verifySession } from "@/lib/session";

/**
 * Gate the app: unauthenticated users are redirected to /sign-in. The eve
 * routes (/eve/*) are intentionally excluded — the eve channel enforces its
 * own auth against the same session cookie.
 *
 * Next.js 16: middleware.ts (Edge) renamed to proxy.ts (Node by default).
 * Eve copies host middleware into its Vercel service; Edge runtime is rejected
 * there ("Edge Runtime is not supported in services"), so stay on Node proxy.
 */
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/api/auth", "/api/board", "/eve", "/field", "/lab"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Vercel Workflow / eve callbacks (/.well-known/workflow/*) must pass
  // through untouched — never redirect them to /sign-in.
  if (isWorkflowPath(pathname)) {
    return NextResponse.next();
  }

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
  // Run on everything except Next internals, static assets and the Workflow
  // routes (/.well-known/workflow/*). Must stay a string literal: Next.js
  // statically analyses config.matcher and rejects imported constants.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};