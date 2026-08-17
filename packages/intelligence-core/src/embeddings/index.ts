import type { EmbeddingProvider } from "./provider";
import { HashingEmbeddingProvider } from "./provider";
import { LocalModelEmbeddingProvider, DEFAULT_MODEL } from "./local-model";

export type { EmbeddingProvider, EmbeddingVector } from "./provider";
export {
  HashingEmbeddingProvider,
  cosineSimilarity,
  normalize,
} from "./provider";
export { LocalModelEmbeddingProvider, DEFAULT_MODEL } from "./local-model";

export type EmbeddingMode = "hashing" | "local";

/**
 * Pick a provider from the environment.
 *
 * `MSTRMND_EMBEDDINGS=local` opts into the on-device sentence-transformer and
 * falls back to hashing (with a warning) when the optional dependency isn't
 * installed — a missing model should degrade search quality, not break the
 * server. `MSTRMND_EMBEDDING_MODEL` overrides which model `local` loads.
 */
export async function resolveEmbeddingProvider(): Promise<EmbeddingProvider> {
  const mode = (process.env.MSTRMND_EMBEDDINGS ?? "hashing").toLowerCase();
  if (mode === "local") {
    if (await LocalModelEmbeddingProvider.isAvailable()) {
      return new LocalModelEmbeddingProvider(
        process.env.MSTRMND_EMBEDDING_MODEL ?? DEFAULT_MODEL
      );
    }
    console.error(
      "MSTRMND: MSTRMND_EMBEDDINGS=local but @huggingface/transformers is not " +
        "installed — falling back to lexical hashing embeddings. " +
        "Install it with: pnpm add -w @huggingface/transformers"
    );
  }
  return new HashingEmbeddingProvider();
}
