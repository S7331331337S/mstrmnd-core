export interface Edge {
  source: string;
  target: string;
  type: string;
}

export class GraphEngine {
  private edges: Edge[] = [];

  /** Record a directed relationship. Returns the stored edge. */
  link(source: string, target: string, type: string): Edge {
    const edge: Edge = { source, target, type };
    this.edges.push(edge);
    return edge;
  }

  /** All edges where `id` is source or target. */
  related(id: string): Edge[] {
    const key = id.toLowerCase();
    return this.edges.filter(
      (e) => e.source.toLowerCase() === key || e.target.toLowerCase() === key
    );
  }

  /** Neighbor ids (the other end of every edge touching `id`). */
  neighbors(id: string): string[] {
    const key = id.toLowerCase();
    const out: string[] = [];
    for (const e of this.edges) {
      if (e.source.toLowerCase() === key) out.push(e.target);
      else if (e.target.toLowerCase() === key) out.push(e.source);
    }
    return out;
  }

  get size(): number {
    return this.edges.length;
  }
}
