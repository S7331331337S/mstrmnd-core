import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { EmbeddingProvider, EmbeddingVector } from "./embeddings";
import { HashingEmbeddingProvider, cosineSimilarity } from "./embeddings";

export interface VectorMatch {
  id: string;
  score: number;
}

export interface IndexEntry {
  id: string;
  text: string;
}

/** Where the on-disk vector cache lives. Keyed per provider, because vectors
 *  from different models share no coordinate system. */
function cachePath(providerName: string): string {
  const home = process.env.HOME ?? ".";
  const slug = providerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return join(home, ".mstrmnd", `embeddings-${slug}.json`);
}

function contentKey(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/**
 * Holds embeddings for the memory graph and answers similarity queries.
 *
 * Embedding is the expensive step, so vectors are cached on disk by content
 * hash: re-indexing an unchanged vault costs a file read rather than a model
 * pass. Cache entries survive edits to unrelated notes and are invalidated
 * automatically when a note's text changes, since the hash is the key.
 */
export class VectorEngine {
  private readonly vectors = new Map<string, EmbeddingVector>();
  private readonly cache = new Map<string, EmbeddingVector>();
  private cacheLoaded = false;
  private cacheDirty = false;

  constructor(private readonly embedder: EmbeddingProvider = new HashingEmbeddingProvider()) {}

  get provider(): EmbeddingProvider {
    return this.embedder;
  }

  get size(): number {
    return this.vectors.size;
  }

  has(id: string): boolean {
    return this.vectors.has(id);
  }

  get(id: string): EmbeddingVector | undefined {
    return this.vectors.get(id);
  }

  clear(): void {
    this.vectors.clear();
  }

  /** Embed a single string without touching the index. */
  async embed(text: string): Promise<EmbeddingVector> {
    const [vector] = await this.embedMany([text]);
    return vector ?? [];
  }

  /**
   * Embed and store every entry. Entries already covered by the cache skip the
   * model entirely, so the common case (a vault that changed in one note) only
   * embeds that note.
   */
  async index(entries: IndexEntry[]): Promise<number> {
    if (entries.length === 0) return 0;
    const vectors = await this.embedMany(entries.map((e) => e.text));
    let stored = 0;
    for (let i = 0; i < entries.length; i++) {
      const vector = vectors[i];
      if (!vector || vector.length === 0) continue;
      this.vectors.set(entries[i]!.id, vector);
      stored++;
    }
    await this.persistCache();
    return stored;
  }

  /** Rank indexed entries against a query, highest cosine similarity first. */
  async search(query: string, limit = 10): Promise<VectorMatch[]> {
    if (this.vectors.size === 0) return [];
    const queryVector = await this.embed(query);
    if (queryVector.length === 0) return [];
    const matches: VectorMatch[] = [];
    for (const [id, vector] of this.vectors) {
      const score = cosineSimilarity(queryVector, vector);
      if (score > 0) matches.push({ id, score });
    }
    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Batch embed with cache read-through. */
  private async embedMany(texts: string[]): Promise<EmbeddingVector[]> {
    await this.loadCache();
    const results = new Array<EmbeddingVector>(texts.length);
    const missingIndexes: number[] = [];
    const missingTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      const cached = this.cache.get(contentKey(texts[i]!));
      if (cached) {
        results[i] = cached;
      } else {
        missingIndexes.push(i);
        missingTexts.push(texts[i]!);
      }
    }

    if (missingTexts.length > 0) {
      const fresh = await this.embedder.embedBatch(missingTexts);
      for (let i = 0; i < missingIndexes.length; i++) {
        const vector = fresh[i] ?? [];
        results[missingIndexes[i]!] = vector;
        this.cache.set(contentKey(missingTexts[i]!), vector);
        this.cacheDirty = true;
      }
    }

    return results;
  }

  private async loadCache(): Promise<void> {
    if (this.cacheLoaded) return;
    this.cacheLoaded = true;
    try {
      const raw = await readFile(cachePath(this.embedder.name), "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (Array.isArray(value)) this.cache.set(key, value as EmbeddingVector);
        }
      }
    } catch {
      // No cache yet, or it's unreadable — recompute rather than fail.
    }
  }

  private async persistCache(): Promise<void> {
    if (!this.cacheDirty) return;
    const path = cachePath(this.embedder.name);
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(Object.fromEntries(this.cache)), "utf8");
      this.cacheDirty = false;
    } catch (err) {
      console.error(`MSTRMND: could not write embedding cache to ${path}`, err);
    }
  }
}
