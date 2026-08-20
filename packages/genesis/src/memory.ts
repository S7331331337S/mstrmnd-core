import type { MemoryRecord } from "./types";

/**
 * Current-view of a memory log: latest non-revoked record per key.
 * History is retained; this only chooses what an agent should read now.
 */
export function currentMemoryView(records: MemoryRecord[]): MemoryRecord[] {
  const byKey = new Map<string, MemoryRecord>();
  const sorted = [...records].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  for (const rec of sorted) {
    if (rec.revoked) {
      byKey.delete(rec.key);
      continue;
    }
    byKey.set(rec.key, rec);
  }
  return [...byKey.values()].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}

export function supersedeMemory(
  previous: MemoryRecord,
  next: Omit<MemoryRecord, "supersedes"> & { reason: string },
): MemoryRecord {
  return {
    ...next,
    supersedes: previous.id,
  };
}
