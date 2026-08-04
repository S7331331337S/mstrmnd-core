import type { RuntimeScope } from "./scope";
import type { Provenance } from "./provenance";

export interface IdentityModel {
  values: string[];
  interests: string[];
  creativePatterns: string[];
  preferences: Array<{
    concept: string;
    affinity: number;
    context?: string;
  }>;
  /** Scope for this identity profile (personal vault defaults to Operator Zero local). */
  scope: RuntimeScope;
  /** Provenance for how the profile was loaded or authored. */
  provenance: Provenance;
}
