import type { EmbeddingProvider, EmbeddingVector } from "./provider";
import { normalize } from "./provider";

/**
 * Real semantic embeddings from a sentence-transformer running on-device via
 * transformers.js — no API key, no network after the first model fetch.
 *
 * `@huggingface/transformers` is an optional dependency: the import specifier is
 * held in a variable so the type checker treats it as dynamic, letting the repo
 * typecheck whether or not the package is installed. `isAvailable()` probes for
 * it, and `resolveEmbeddingProvider` falls back to hashing when it's absent.
 */

const PACKAGE = "@huggingface/transformers";

/** Default model: 384-dim, ~90MB, strong quality-per-byte for note-sized text. */
export const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

type FeatureExtractor = (
  input: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

export class LocalModelEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dimensions = 384;

  private readonly model: string;
  private extractor: FeatureExtractor | null = null;
  private loading: Promise<FeatureExtractor> | null = null;

  constructor(model = DEFAULT_MODEL) {
    this.model = model;
    this.name = `local:${model}`;
  }

  /** True when the optional transformers.js dependency can be imported. */
  static async isAvailable(): Promise<boolean> {
    try {
      await import(PACKAGE);
      return true;
    } catch {
      return false;
    }
  }

  /** Load the pipeline once. Concurrent callers await the same promise so a
   *  batch of queries at boot doesn't download the model several times over. */
  private async pipeline(): Promise<FeatureExtractor> {
    if (this.extractor) return this.extractor;
    if (!this.loading) {
      this.loading = (async () => {
        const mod = await import(PACKAGE);
        const extractor = (await mod.pipeline(
          "feature-extraction",
          this.model
        )) as FeatureExtractor;
        this.extractor = extractor;
        return extractor;
      })();
    }
    return this.loading;
  }

  async embed(text: string): Promise<EmbeddingVector> {
    const [vector] = await this.embedBatch([text]);
    return vector ?? [];
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (texts.length === 0) return [];
    const extract = await this.pipeline();
    const output = await extract(texts, { pooling: "mean", normalize: true });
    return output.tolist().map((v) => normalize(v));
  }
}
