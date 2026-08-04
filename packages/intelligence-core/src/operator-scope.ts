import type { Provenance, RuntimeScope } from "@mstrmnd/schemas";

/**
 * Default scope for Operator Zero local-first operation.
 * Personal Obsidian vaults map here until multi-tenant wiring exists.
 */
export const OPERATOR_ZERO_SCOPE: RuntimeScope = {
  organizationId: "mstrmnd",
  workspaceId: "operator-zero",
  userId: "local-operator",
  role: "owner",
  brandId: "mstrmnd",
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function localProvenance(
  source: string,
  extras: Partial<Provenance> = {}
): Provenance {
  return {
    source,
    ingestedAt: nowIso(),
    ...extras,
  };
}

/** Merge overrides onto Operator Zero defaults without dropping required fields. */
export function resolveScope(overrides?: Partial<RuntimeScope>): RuntimeScope {
  return {
    ...OPERATOR_ZERO_SCOPE,
    ...overrides,
  };
}
