import type { MemoryNode } from "@mstrmnd/schemas";
import { readVault, type VaultNote } from "../../../connectors/obsidian/vault-reader";

export class MemoryEngine {
  private nodes: MemoryNode[] = [];

  /** Store a single memory node. */
  store(node: MemoryNode): MemoryNode {
    this.nodes.push(node);
    return node;
  }

  /** Return all stored nodes. */
  all(): MemoryNode[] {
    return this.nodes;
  }

  get size(): number {
    return this.nodes.length;
  }

  /**
   * Keyword search over title + relationships. Case-insensitive.
   * Returns nodes whose title or any relationship contains the query.
   */
  search(query: string): { query: string; memories: MemoryNode[] } {
    const q = query.toLowerCase();
    const memories = this.nodes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.relationships.some((r) => r.toLowerCase().includes(q))
    );
    return { query, memories };
  }

  /**
   * Load an Obsidian vault into the memory graph. Each note becomes a
   * `MemoryNode` of type 'memory', with its tags as relationships.
   */
  async loadVault(vaultPath: string): Promise<MemoryNode[]> {
    const notes: VaultNote[] = await readVault(vaultPath);
    for (const note of notes) {
      this.store({
        id: note.relativePath,
        type: "memory",
        title: note.title,
        confidence: 1,
        relationships: note.tags,
      });
    }
    return this.nodes;
  }
}
