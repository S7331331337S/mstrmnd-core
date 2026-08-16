import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Third-Mind — the shared observation / memory layer.
 *
 * Agents and the app read and write observations here; it is the continuity
 * substrate that makes the alliance a "collective mind" across sessions.
 *
 * This Slice-1 implementation is a durable, file-backed store that runs with
 * zero external services (ideal for local dev and CI). The `ThirdMindStore`
 * interface is the seam for the production adapter (Neon/Postgres + vectors,
 * or Vercel Blob for artifacts), which is the dedicated "memory layer" slice.
 */

export interface Observation {
  id: string;
  key: string;
  content: string;
  tags: string[];
  agent: string;
  createdAt: string;
}

export interface SearchHit extends Observation {
  score: number;
}

export interface ThirdMindStore {
  write(input: {
    key: string;
    content: string;
    tags?: string[];
    agent?: string;
  }): Promise<Observation>;
  read(idOrKey: string): Promise<Observation | null>;
  search(query: string, limit?: number): Promise<SearchHit[]>;
  list(limit?: number): Promise<Observation[]>;
}

function storePath(): string {
  const configured = process.env.THIRD_MIND_PATH;
  if (configured) {
    return isAbsolute(configured) ? configured : join(process.cwd(), configured);
  }
  return join(process.cwd(), ".mstrmnd", "third-mind.json");
}

function loadAll(path: string): Observation[] {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? (parsed as Observation[]) : [];
  } catch {
    return [];
  }
}

function saveAll(path: string, rows: Observation[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function scoreRow(row: Observation, terms: string[]): number {
  if (terms.length === 0) return 0;
  const haystack = tokenize(`${row.key} ${row.content} ${row.tags.join(" ")}`);
  const bag = new Map<string, number>();
  for (const t of haystack) bag.set(t, (bag.get(t) ?? 0) + 1);
  let score = 0;
  for (const term of terms) {
    if (bag.has(term)) score += bag.get(term)!;
    // light prefix credit so "research" matches "researcher"
    else for (const h of bag.keys()) if (h.startsWith(term)) score += 0.5;
  }
  return score;
}

/** File-backed Third-Mind store. Portable, durable, no external services. */
export class FileThirdMindStore implements ThirdMindStore {
  constructor(private readonly path = storePath()) {}

  async write(input: {
    key: string;
    content: string;
    tags?: string[];
    agent?: string;
  }): Promise<Observation> {
    const rows = loadAll(this.path);
    const now = new Date().toISOString();
    const existingIdx = rows.findIndex((r) => r.key === input.key);
    const observation: Observation = {
      id: existingIdx >= 0 ? rows[existingIdx].id : randomUUID(),
      key: input.key,
      content: input.content,
      tags: input.tags ?? [],
      agent: input.agent ?? "unknown",
      createdAt: now,
    };
    if (existingIdx >= 0) rows[existingIdx] = observation;
    else rows.push(observation);
    saveAll(this.path, rows);
    return observation;
  }

  async read(idOrKey: string): Promise<Observation | null> {
    const rows = loadAll(this.path);
    return rows.find((r) => r.id === idOrKey || r.key === idOrKey) ?? null;
  }

  async search(query: string, limit = 10): Promise<SearchHit[]> {
    const rows = loadAll(this.path);
    const terms = tokenize(query);
    return rows
      .map((r) => ({ ...r, score: scoreRow(r, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async list(limit = 50): Promise<Observation[]> {
    const rows = loadAll(this.path);
    return rows
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

let singleton: ThirdMindStore | null = null;

/** Shared Third-Mind store instance for tools and the app. */
export function thirdMind(): ThirdMindStore {
  if (!singleton) singleton = new FileThirdMindStore();
  return singleton;
}
