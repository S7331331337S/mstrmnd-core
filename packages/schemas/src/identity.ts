export interface IdentityModel {
  values: string[];
  interests: string[];
  creativePatterns: string[];
  preferences: Array<{
    concept: string;
    affinity: number;
    context?: string;
  }>;
}
