import type {
  CreativeBenchmarkReport,
  CreativeProviderCase,
} from "@mstrmnd/schemas";

/**
 * GPT-Image-2 transparent-background candidate vs background-removal
 * post-processing. Do not make GPT-Image-2 the default until a *live* eval
 * beats the post-process baseline on halo, consistency, and cost.
 *
 * Pricing snapshot (2026-08-20): GPT-Image-2 $8/M input · $30/M output tokens
 * (Batch ~half). Recorded here for the benchmark, not as a live quote.
 */
export const GPT_IMAGE_2_PRICING = {
  inputUsdPerMillion: 8,
  outputUsdPerMillion: 30,
  batchDiscount: 0.5,
  transparentBackground: true as const,
  apiBackgroundParam: 'background: "transparent"',
};

const USE_CASES = [
  "product-cutout",
  "avatar",
  "app-asset",
  "social-overlay",
  "presentation",
  "brand-composite",
] as const;

/** Synthetic scores so the scorer is executable offline. Not a live bake-off. */
export function fixtureCreativeCases(): CreativeProviderCase[] {
  const cases: CreativeProviderCase[] = [];
  for (const useCase of USE_CASES) {
    cases.push({
      id: `${useCase}:postprocess-removal`,
      useCase,
      provider: "postprocess-removal",
      background: "transparent",
      costUsd: 0.04,
      edgeHalo: 0.18,
      consistency: 0.72,
      usability: 0.75,
      source: "fixture-synthetic",
    });
    cases.push({
      id: `${useCase}:gpt-image-2`,
      useCase,
      provider: "gpt-image-2",
      background: "transparent",
      costUsd: 0.03,
      edgeHalo: 0.12,
      consistency: 0.7,
      usability: 0.78,
      source: "fixture-synthetic",
    });
  }
  return cases;
}

export function scoreCreativeBenchmark(
  cases: CreativeProviderCase[]
): CreativeBenchmarkReport {
  const live = cases.filter((c) => c.source === "live");
  const gptLive = live.filter(
    (c) => c.provider === "gpt-image-2" && c.background === "transparent"
  );
  const baselineLive = live.filter((c) => c.provider === "postprocess-removal");
  const gptReady =
    gptLive.length >= USE_CASES.length &&
    baselineLive.length >= USE_CASES.length &&
    averageScore(gptLive) > averageScore(baselineLive);

  return {
    cases,
    recommendedDefault: gptReady ? "gpt-image-2" : "postprocess-removal",
    gptImage2TransparentReady: gptReady,
    notes: [
      "GPT-Image-2 transparent output is a candidate for product cutouts, avatars, app/site assets, social overlays, presentation graphics, and brand-template composites.",
      gptReady
        ? "Live eval beat post-processing — GPT-Image-2 transparent may be the default."
        : "Keep post-processing as default until a live eval (not fixture-synthetic) beats it on halo, consistency, and cost.",
      `API: ${GPT_IMAGE_2_PRICING.apiBackgroundParam}; list price input $${GPT_IMAGE_2_PRICING.inputUsdPerMillion}/M, output $${GPT_IMAGE_2_PRICING.outputUsdPerMillion}/M.`,
    ],
  };
}

function averageScore(cases: CreativeProviderCase[]): number {
  if (!cases.length) return 0;
  const sum = cases.reduce(
    (n, c) => n + (1 - c.edgeHalo) * 0.4 + c.consistency * 0.3 + c.usability * 0.3 - c.costUsd,
    0
  );
  return sum / cases.length;
}
