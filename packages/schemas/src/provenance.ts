/**
 * Where a record came from and how it entered the runtime.
 */
export interface Provenance {
  /** Logical source system, e.g. "obsidian", "filesystem", "doctrine", "user" */
  source: string;
  /** Adapter that performed the ingest/transform */
  adapter?: string;
  /** Source-native path or URI when applicable */
  sourcePath?: string;
  /** ISO-8601 timestamp when the runtime ingested or created the record */
  ingestedAt: string;
  /** Pinned doctrine commit SHA when doctrine influenced the record */
  doctrineRef?: string;
  /** Free-form producer id (script, skill, human) */
  producedBy?: string;
  /** Confidence the provenance metadata itself is correct (0–1) */
  confidence?: number;
}
