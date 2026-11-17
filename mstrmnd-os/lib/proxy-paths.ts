/**
 * Path rules for proxy.ts, kept free of `next/*` imports so they can be unit
 * tested with plain `tsx --test`.
 */

/**
 * Vercel Workflow / eve internal routes. The runtime POSTs to
 * `/.well-known/workflow/v1/flow` (and `/step`, `/webhook/*`) with its own
 * auth; a proxy that redirects or touches these requests breaks workflow
 * execution ("Cannot perform ArrayBuffer.prototype.slice on a detached
 * ArrayBuffer"). Must never be gated or rewritten by the session proxy.
 * https://useworkflow.dev/docs/getting-started/next (Configure Proxy Handler)
 */
export const WORKFLOW_PREFIX = "/.well-known/workflow";

export function isWorkflowPath(pathname: string): boolean {
  return pathname === WORKFLOW_PREFIX || pathname.startsWith(`${WORKFLOW_PREFIX}/`);
}
