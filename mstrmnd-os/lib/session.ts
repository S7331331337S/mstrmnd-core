import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-safe session primitives (no `next/headers`), shared by middleware, the
 * eve agent channel, and route handlers. A signed JWT lives in an httpOnly
 * cookie; app and agent verify the same token.
 */

export const SESSION_COOKIE = "mstrmnd_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
  return new TextEncoder().encode(value);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    workspaceId: user.workspaceId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      workspaceId: String(payload.workspaceId ?? `ws_${payload.sub}`),
    };
  } catch {
    return null;
  }
}

/** Read the session token value from a raw Cookie header. */
export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Bearer token from a mobile / Board client, if present. */
export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token) return null;
  return scheme.toLowerCase() === "bearer" ? token.trim() : null;
}

/** Verify the session from an incoming Request (used by the eve channel and Board). */
export async function getSessionFromRequest(
  request: Request,
): Promise<SessionUser | null> {
  const bearer = readBearerToken(request.headers.get("authorization"));
  if (bearer) return verifySession(bearer);
  const token = readSessionCookie(request.headers.get("cookie"));
  return token ? verifySession(token) : null;
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
