import { VectorEngine, localProvenance, resolveScope } from "@mstrmnd/intelligence-core";
import type { Artifact, RuntimeScope } from "@mstrmnd/schemas";

export interface VisionInput {
  source: string;
  path: string;
  type?: Artifact["type"];
  id?: string;
  scope?: Partial<RuntimeScope>;
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
      scope: resolveScope(input.scope),
      provenance: localProvenance(input.source, {
        adapter: "vision-agent",
        sourcePath: input.path,
        producedBy: "vision-agent",
      }),
    };
  }
}
