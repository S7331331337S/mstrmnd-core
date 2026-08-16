import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Third-Mind — the shared observation / memory layer.
 *
 * Multi-tenant: every observation carries a `scope` (a workspace id) and all
 * reads/writes are scoped, so one workspace never sees another's memory. The
 * scope is derived from the authenticated caller (the eve channel maps the app
 * session to a principal; the app maps the session to a workspaceId).
 *
 * Slice implementation: durable, file-backed store with zero external services
 * (local dev / CI). The `ThirdMindStore` interface is the seam for the
 * production adapter (Neon/Postgres + vectors, or Blob for artifacts).
 */

export interface Observation {
  id: string;
  scope: string;
  key: string;
  content: string;
  tags: string[];
  agent: string;
  createdAt: string;
}

export interface SearchHit extends Observation {
  score: number;
}

export interface WriteInput {
  scope: string;
  key: string;
  content: string;
  tags?: string[];
  agent?: string;
}

export interface ThirdMindStore {
  write(input: WriteInput): Promise<Observation>;
  read(scope: string, idOrKey: string): Promise<Observation | null>;
  search(scope: string, query: string, limit?: number): Promise<SearchHit[]>;
  list(scope: string, limit?: number): Promise<Observation[]>;
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
    else for (const h of bag.keys()) if (h.startsWith(term)) score += 0.5;
  }
  return score;
}

/** File-backed, scope-aware Third-Mind store. Portable, durable, no services. */
export class FileThirdMindStore implements ThirdMindStore {
  constructor(private readonly path = storePath()) {}

  async write(input: WriteInput): Promise<Observation> {
    const rows = loadAll(this.path);
    const now = new Date().toISOString();
    const existingIdx = rows.findIndex(
      (r) => r.scope === input.scope && r.key === input.key,
    );
    const observation: Observation = {
      id: existingIdx >= 0 ? rows[existingIdx].id : randomUUID(),
      scope: input.scope,
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

  async read(scope: string, idOrKey: string): Promise<Observation | null> {
    const rows = loadAll(this.path);
    return (
      rows.find(
        (r) => r.scope === scope && (r.id === idOrKey || r.key === idOrKey),
      ) ?? null
    );
  }

  async search(scope: string, query: string, limit = 10): Promise<SearchHit[]> {
    const terms = tokenize(query);
    return loadAll(this.path)
      .filter((r) => r.scope === scope)
      .map((r) => ({ ...r, score: scoreRow(r, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async list(scope: string, limit = 50): Promise<Observation[]> {
    return loadAll(this.path)
      .filter((r) => r.scope === scope)
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

/** Fallback scope for unauthenticated/local contexts. */
export const DEFAULT_SCOPE = "ws_local";
