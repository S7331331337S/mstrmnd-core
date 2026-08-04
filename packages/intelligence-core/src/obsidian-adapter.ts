import { readVault, type VaultNote } from "@mstrmnd/connectors";
import type { MemorySourceRecord } from "@mstrmnd/schemas";

/**
 * Obsidian adapter: translate vault notes into vendor-neutral memory source records.
 * Domain engines must consume MemorySourceRecord, not VaultNote.
 */
export function vaultNotesToSourceRecords(notes: VaultNote[]): MemorySourceRecord[] {
  return notes.map((note) => ({
    id: note.relativePath,
    title: note.title,
    content: note.body,
    tags: note.tags,
    links: note.links,
    folder: note.folder || undefined,
    sourcePath: note.relativePath,
  }));
}

/** Read an Obsidian vault and return domain-neutral source records. */
export async function readObsidianSourceRecords(
  vaultPath: string
): Promise<MemorySourceRecord[]> {
  const notes = await readVault(vaultPath);
  return vaultNotesToSourceRecords(notes);
}
