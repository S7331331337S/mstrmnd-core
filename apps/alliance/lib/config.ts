/**
 * Backend configuration.
 *
 * The app is hosting-agnostic by construction: it addresses whatever host is
 * currently serving the MSTRMND OS agent runtime, and nothing about that host
 * is baked into the bundle. Vercel, a container on ECS or Cloud Run, or a
 * laptop on the same network are all the same to this client — one URL.
 *
 * Set it per build/profile:
 *
 *   EXPO_PUBLIC_MSTRMND_API_URL=https://os.mstrmnd.example
 *   EXPO_PUBLIC_MSTRMND_API_URL=http://192.168.1.20:3000   # local self-host
 *
 * Unset, the app runs in demo mode against local mock data — no network, no
 * assumption about who is hosting the alliance.
 */

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Configured backend origin, or null when the app should stay in demo mode. */
export function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_MSTRMND_API_URL;
  if (!raw || raw.trim().length === 0) return null;
  return normalize(raw);
}

/** True when a backend is configured and live calls should be attempted. */
export function isBackendConfigured(): boolean {
  return apiBaseUrl() !== null;
}

/**
 * Absolute URL for an eve runtime path. The runtime mounts its HTTP API under
 * `/eve/v1/*` on whatever origin serves it, so joining is all this needs to be.
 */
export function apiUrl(path: string): string {
  const base = apiBaseUrl();
  if (!base) throw new Error("EXPO_PUBLIC_MSTRMND_API_URL is not configured");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Short label for status surfaces — the host we are pointed at, or "demo". */
export function backendLabel(): string {
  const base = apiBaseUrl();
  if (!base) return "demo";
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}
