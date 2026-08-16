import { DEFAULT_SCOPE } from "./third-mind";

interface AuthLike {
  session?: {
    auth?: {
      current?: {
        principalId?: string;
        attributes?: { workspaceId?: string; email?: string };
      } | null;
    };
  };
}

/**
 * Derive the Third-Mind scope (workspace id) from an eve tool context. The eve
 * channel maps the app session into `ctx.session.auth.current`; we scope memory
 * to that caller's workspace so tenants never cross.
 */
export function scopeFromCtx(ctx: unknown): string {
  const current = (ctx as AuthLike)?.session?.auth?.current;
  const ws = current?.attributes?.workspaceId;
  if (typeof ws === "string" && ws.length > 0) return ws;
  const pid = current?.principalId;
  if (typeof pid === "string" && pid.length > 0) return `ws_${pid}`;
  return DEFAULT_SCOPE;
}

export function agentFromCtx(ctx: unknown, fallback: string): string {
  const name = (ctx as { session?: { agent?: { name?: string } } })?.session
    ?.agent?.name;
  return typeof name === "string" && name.length > 0 ? name : fallback;
}
