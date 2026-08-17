/**
 * Embedding providers turn text into vectors for semantic search.
 *
 * Anthropic's API has no embeddings endpoint, so nothing here calls Claude.
 * The default provider runs entirely on-device with zero dependencies; a real
 * sentence-transformer can be swapped in via `local-model.ts`. Both satisfy the
 * same interface, so the rest of the stack never learns which one is active.
 */

export type EmbeddingVector = number[];

export interface EmbeddingProvider {
  /** Stable identifier, surfaced in logs and the MCP `get_identity` payload. */
  readonly name: string;
  /** Vector width. Vectors from different widths are never comparable. */
  readonly dimensions: number;
  embed(text: string): Promise<EmbeddingVector>;
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;
}

/**
 * Cosine similarity in [-1, 1]. Returns 0 for zero-magnitude or mismatched
 * vectors rather than NaN, so a missing embedding degrades to "no signal"
 * instead of poisoning a ranked result set.
 */
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Scale a vector to unit length so cosine similarity reduces to a dot product. */
export function normalize(vector: EmbeddingVector): EmbeddingVector {
  let mag = 0;
  for (const v of vector) mag += v * v;
  if (mag === 0) return vector;
  const inv = 1 / Math.sqrt(mag);
  return vector.map((v) => v * inv);
}

const DEFAULT_DIMENSIONS = 384;

/** FNV-1a. Cheap, well-distributed, and stable across runs — the last property
 *  matters because vectors are cached on disk between sessions. */
function hashToken(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 1);
}

/**
 * Zero-dependency fallback using the hashing trick: every token is projected
 * into a fixed-width vector with a hash-derived sign, weighted by sublinear
 * term frequency.
 *
 * This is *lexical*, not semantic — "car" and "automobile" land in unrelated
 * dimensions. It exists so search works offline with no model download and no
 * network, and so the vector plumbing is exercised by default. For genuine
 * semantic matching use `LocalModelEmbeddingProvider`.
 */
export class HashingEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hashing";
  readonly dimensions: number;

  constructor(dimensions = DEFAULT_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<EmbeddingVector> {
    const counts = new Map<string, number>();
    for (const token of tokenize(text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    const vector = new Array<number>(this.dimensions).fill(0);
    for (const [token, count] of counts) {
      const hash = hashToken(token);
      const index = hash % this.dimensions;
      // Bit 31 picks the sign so colliding tokens can cancel instead of always
      // reinforcing each other.
      const sign = (hash & 0x80000000) !== 0 ? -1 : 1;
      vector[index] += sign * (1 + Math.log(count));
    }
    return normalize(vector);
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
