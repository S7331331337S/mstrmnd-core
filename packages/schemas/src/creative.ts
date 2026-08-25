/**
 * Creative-provider benchmark. Generation providers (Firefly, GPT-Image-2,
 * etc.) are execution resources. MSTRMND owns the closed loop above them.
 */
export type CreativeUseCase =
  | "product-cutout"
  | "avatar"
  | "app-asset"
  | "social-overlay"
  | "presentation"
  | "brand-composite";

export type CreativeProviderId = "gpt-image-2" | "postprocess-removal";

export interface CreativeProviderCase {
  id: string;
  useCase: CreativeUseCase;
  provider: CreativeProviderId;
  background: "transparent" | "opaque";
  /** USD for this sample (estimated or measured) */
  costUsd: number;
  /** 0–1; lower halo is better */
  edgeHalo: number;
  /** 0–1; higher is better */
  consistency: number;
  /** 0–1; higher is better */
  usability: number;
  /** fixture-synthetic until a live provider eval is recorded */
  source: "fixture-synthetic" | "live";
}

export interface CreativeBenchmarkReport {
  cases: CreativeProviderCase[];
  /** Winner per use case — never auto-default until live eval beats baseline. */
  recommendedDefault: CreativeProviderId;
  gptImage2TransparentReady: boolean;
  notes: string[];
}
