export { MemoryEngine } from "./memory-engine";
export type { SearchMode, ScoredMemory } from "./memory-engine";
export { VectorEngine } from "./vector-engine";
export type { VectorMatch, IndexEntry } from "./vector-engine";
export { GraphEngine } from "./graph-engine";
export {
  HashingEmbeddingProvider,
  LocalModelEmbeddingProvider,
  resolveEmbeddingProvider,
  cosineSimilarity,
  normalize,
  DEFAULT_MODEL,
} from "./embeddings";
export type {
  EmbeddingProvider,
  EmbeddingVector,
  EmbeddingMode,
} from "./embeddings";
export { resolveVaultPath } from "./vault-path";
export { loadIdentity, EMPTY_IDENTITY } from "./identity-loader";
