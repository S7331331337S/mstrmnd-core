import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session";

export * from "./session";

/** Server-side: current session from Next cookies() (RSC / route handlers). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}
