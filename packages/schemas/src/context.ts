import type { RuntimeScope } from "./scope";
import type { Provenance } from "./provenance";
import type { IdentityModel } from "./identity";
import type { MemoryNode } from "./memory";

/** Human operator profile within a scoped workspace. */
export interface OperatorProfile {
  id: string;
  displayName: string;
  role?: string;
  /** Paths or ids pointing at preference notes */
  preferenceRefs?: string[];
  scope: RuntimeScope;
  provenance: Provenance;
}

/** Company / organization profile for Operator Zero and future tenants. */
export interface CompanyProfile {
  id: string;
  name: string;
  /** Short mission / positioning summary (may be truncated from doctrine) */
  missionSummary?: string;
  /** Paths into doctrine or vault for systems map, brand, etc. */
  systemsMapRefs?: string[];
  brandId?: string;
  positioningRef?: string;
  scope: RuntimeScope;
  provenance: Provenance;
}

/** Lightweight business goals and active work — not a full CRM. */
export interface BusinessContext {
  goals: string[];
  constraints: string[];
  activeProjects: Array<{ id: string; summary: string }>;
  activeClients: Array<{ id: string; summary: string }>;
  scope: RuntimeScope;
  provenance: Provenance;
}

/**
 * Assembled context for a run: doctrine + identity + operator/company
 * + optional memory hits and workspace roots.
 */
export interface ContextPack {
  scope: RuntimeScope;
  /** Pinned doctrine commit SHA when available */
  doctrineRef: string | null;
  operator: OperatorProfile;
  company: CompanyProfile;
  business: BusinessContext;
  identity: IdentityModel;
  memoryHits: MemoryNode[];
  workspaceRoots: string[];
  /** Doctrine file paths included as summaries */
  doctrineSlice?: Array<{ path: string; summary: string }>;
  assembledAt: string;
}
