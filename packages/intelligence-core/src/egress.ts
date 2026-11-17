/**
 * Env-driven egress allowlist for the default (Operator Zero) boundary.
 *
 * Deny stays the default: with `MSTRMND_EGRESS_ALLOWLIST` unset (or blank) the
 * network allowlist is empty and nothing changes. When set, it must be a
 * comma-separated list of exact hostnames; anything else is a load error so a
 * typo can never silently widen (or silently drop) access.
 *
 * Env:
 * - MSTRMND_EGRESS_ALLOWLIST          comma-separated exact hostnames
 * - MSTRMND_MODEL_PROCESS_BUDGET_USD  per-process cap on summed model-call
 *                                     reservations; required when an allowlist is set.
 *                                     The existing per-call reservation is
 *                                     MSTRMND_MODEL_CALL_BUDGET_USD (unchanged).
 */

export const EGRESS_ALLOWLIST_ENV = "MSTRMND_EGRESS_ALLOWLIST";
export const PROCESS_BUDGET_ENV = "MSTRMND_MODEL_PROCESS_BUDGET_USD";
/** Credential id the model providers declare in their access policy. */
export const MODEL_CREDENTIAL_ID = "model-api-key";

export class EgressConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EgressConfigError";
  }
}

const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const HOSTNAME_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`);
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Validate one entry; returns the normalized (trimmed, lower-case) hostname. */
function parseHost(raw: string, index: number): string {
  const entry = raw.trim().toLowerCase();
  const where = `${EGRESS_ALLOWLIST_ENV} entry #${index + 1}`;
  if (!entry) {
    throw new EgressConfigError(`${where} is empty (stray comma?); entries must be exact hostnames`);
  }
  if (entry.includes("*")) {
    throw new EgressConfigError(`${where} "${entry}" contains a wildcard; only exact hostnames are allowed`);
  }
  if (entry.includes("://")) {
    throw new EgressConfigError(`${where} "${entry}" contains a scheme; use a bare hostname`);
  }
  if (/[/?#@\s]/.test(entry)) {
    throw new EgressConfigError(`${where} "${entry}" contains a path, query, credentials or whitespace; use a bare hostname`);
  }
  if (entry.includes(":")) {
    throw new EgressConfigError(`${where} "${entry}" contains a port or IPv6 literal; use a bare hostname`);
  }
  if (IPV4_RE.test(entry) || !HOSTNAME_RE.test(entry)) {
    throw new EgressConfigError(`${where} "${entry}" is not a valid exact hostname (IP literals are not allowed)`);
  }
  return entry;
}

/** Parse the allowlist. Unset or blank => `[]` (deny-all). Invalid => throws. */
export function parseEgressAllowlist(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") return [];
  const hosts = raw.split(",").map(parseHost);
  return [...new Set(hosts)];
}

export type BudgetReservation = { ok: true } | { ok: false; reason: string };

/** Process-wide cap on the summed per-call cost reservations of model calls. */
export class ProcessModelBudget {
  private used = 0;
  constructor(readonly capUsd: number) {
    if (!Number.isFinite(capUsd) || capUsd < 0) {
      throw new EgressConfigError(`${PROCESS_BUDGET_ENV} must be a finite number >= 0`);
    }
  }
  get usedUsd(): number {
    return this.used;
  }
  tryReserve(estimateUsd: number): BudgetReservation {
    if (!Number.isFinite(estimateUsd) || estimateUsd < 0) {
      return { ok: false, reason: "model call has no finite cost reservation (set MSTRMND_MODEL_CALL_BUDGET_USD)" };
    }
    if (this.capUsd <= 0 || this.used + estimateUsd > this.capUsd) {
      return {
        ok: false,
        reason: `process model budget exhausted (used $${this.used} + $${estimateUsd} > cap $${this.capUsd})`,
      };
    }
    this.used += estimateUsd;
    return { ok: true };
  }
}

let sharedBudget: ProcessModelBudget | undefined;

/** One budget per process (the MCP server builds a runtime per request). */
function processBudget(capUsd: number): ProcessModelBudget {
  if (!sharedBudget || sharedBudget.capUsd !== capUsd) sharedBudget = new ProcessModelBudget(capUsd);
  return sharedBudget;
}

/** Test hook. */
export function resetProcessModelBudget(): void {
  sharedBudget = undefined;
}

export interface EgressConfig {
  networkAllowlist: string[];
  /** `[MODEL_CREDENTIAL_ID]` only when a host is allowlisted; otherwise `[]`. */
  credentialAllowlist: string[];
  processBudget: ProcessModelBudget | null;
}

/** Load egress config from env. Throws EgressConfigError on any invalid value. */
export function loadEgressConfig(env: NodeJS.ProcessEnv = process.env): EgressConfig {
  const networkAllowlist = parseEgressAllowlist(env[EGRESS_ALLOWLIST_ENV]);
  const rawBudget = env[PROCESS_BUDGET_ENV]?.trim();
  let cap: number | undefined;
  if (rawBudget) {
    cap = Number(rawBudget);
    if (!Number.isFinite(cap) || cap < 0) {
      throw new EgressConfigError(`${PROCESS_BUDGET_ENV}="${rawBudget}" must be a finite number >= 0`);
    }
  }
  if (networkAllowlist.length > 0 && cap === undefined) {
    throw new EgressConfigError(`${PROCESS_BUDGET_ENV} is required when ${EGRESS_ALLOWLIST_ENV} is set (fail closed)`);
  }
  return {
    networkAllowlist,
    // The boundary's credential allowlist is global, not per host. It is only
    // opened when a host is allowlisted, and the provider's access policy
    // always pairs this credential id with its host, so a use against an
    // off-list host is still denied.
    credentialAllowlist: networkAllowlist.length > 0 ? [MODEL_CREDENTIAL_ID] : [],
    processBudget: cap === undefined ? null : processBudget(cap),
  };
}

function hostOf(destination: string): string {
  try {
    return new URL(destination.includes("://") ? destination : `https://${destination}`).hostname.toLowerCase();
  } catch {
    return "(unparseable)";
  }
}

/** Log a denied model call. Host and reason only; never secrets or URLs with paths/queries. */
export function logEgressDenied(destinations: string[], reason: string): void {
  const hosts = destinations.map(hostOf).join(",") || "(none)";
  // Boundary reasons embed the raw destination URL; reduce any URL to its host so
  // userinfo, paths and query strings can never reach the log.
  const safeReason = reason.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s,)]+/gi, (url) => hostOf(url));
  console.error(`[egress-denied] host=${hosts} reason=${safeReason}`);
}
