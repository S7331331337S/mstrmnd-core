import type { RuntimeScope } from "./scope";
import type { Provenance } from "./provenance";

export interface MemoryNode {
  id: string;
  type: "memory" | "concept" | "artifact";
  title: string;
  /** Note body text (adapter-normalized; Obsidian frontmatter stripped at edge). */
  content?: string;
  confidence: number;
  /** Tags / relationship labels (not graph edges). */
  relationships: string[];
  /** Required tenant/operator scope. */
  scope: RuntimeScope;
  /** Required ingest/create provenance. */
  provenance: Provenance;
}

/**
 * Vendor-neutral memory ingest record.
 * Adapters (Obsidian, filesystem, etc.) map into this shape before
 * MemoryEngine persistence — domain logic must not depend on VaultNote.
 */
export interface MemorySourceRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
  /** Outbound link targets in source-native form */
  links: string[];
  /** Optional folder / collection grouping key */
  folder?: string;
  /** Source-native path for provenance */
  sourcePath?: string;
}
