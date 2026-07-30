export interface MemoryNode {
  id: string;
  type: "memory" | "concept" | "artifact";
  title: string;
  /** Note body text (Obsidian markdown, frontmatter stripped). */
  content?: string;
  confidence: number;
  relationships: string[];
}
