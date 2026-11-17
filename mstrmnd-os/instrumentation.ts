import { resolveAuthSecret } from "./lib/session";

/**
 * Runs once when a server instance starts. Refuse to boot in production
 * without a real AUTH_SECRET, rather than serving with a forgeable fallback.
 */
export function register(): void {
  resolveAuthSecret();
}
