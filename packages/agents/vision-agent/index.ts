import { VectorEngine } from "@mstrmnd/intelligence-core";
import type { Artifact } from "@mstrmnd/schemas";

export interface VisionInput {
  source: string;
  path: string;
  type?: Artifact["type"];
  id?: string;
}

export class VisionAgent {
  private embedder = new VectorEngine();

  /** Produce a typed Artifact from a vision source. The embedding is pulled
   *  from the shared VectorEngine; `analysis` is populated when a real vision
   *  model is attached (stays empty until then). */
  async analyze(input: VisionInput): Promise<Artifact> {
    const { vector } = await this.embedder.embed(input.path);
    return {
      id: input.id ?? input.path,
      type: input.type ?? "image",
      source: input.source,
      path: input.path,
      analysis: { concepts: [], style: [], emotions: [] },
      embedding: vector,
    };
  }
}
