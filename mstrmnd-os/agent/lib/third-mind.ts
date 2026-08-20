import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { hasDatabase, getPool, ensureSchema } from "../../lib/db";

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
  /** Previous observation id this record replaces. Null on first write. */
  supersedes?: string | null;
  reason?: string;
  sourceEventId?: string;
  revoked?: boolean;
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
  reason?: string;
  sourceEventId?: string;
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

function currentView(rows: Observation[], scope: string): Observation[] {
  const byKey = new Map<string, Observation>();
  const scoped = rows
    .filter((r) => r.scope === scope && !r.revoked)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const rec of scoped) byKey.set(rec.key, rec);
  return [...byKey.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

/** File-backed, scope-aware Third-Mind store. Portable, durable, no services. */
export class FileThirdMindStore implements ThirdMindStore {
  constructor(private readonly path = storePath()) {}

  async write(input: WriteInput): Promise<Observation> {
    const rows = loadAll(this.path);
    const now = new Date().toISOString();
    const current = currentView(rows, input.scope).find((r) => r.key === input.key);
    const observation: Observation = {
      id: randomUUID(),
      scope: input.scope,
      key: input.key,
      content: input.content,
      tags: input.tags ?? [],
      agent: input.agent ?? "unknown",
      createdAt: now,
      supersedes: current?.id ?? null,
      reason: input.reason ?? (current ? "superseded" : undefined),
      sourceEventId: input.sourceEventId,
    };
    rows.push(observation);
    saveAll(this.path, rows);
    return observation;
  }

  async read(scope: string, idOrKey: string): Promise<Observation | null> {
    const rows = loadAll(this.path).filter((r) => r.scope === scope);
    const byId = rows.find((r) => r.id === idOrKey);
    if (byId) return byId;
    return currentView(rows, scope).find((r) => r.key === idOrKey) ?? null;
  }

  async search(scope: string, query: string, limit = 10): Promise<SearchHit[]> {
    const terms = tokenize(query);
    return currentView(loadAll(this.path), scope)
      .map((r) => ({ ...r, score: scoreRow(r, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async list(scope: string, limit = 50): Promise<Observation[]> {
    return currentView(loadAll(this.path), scope).slice(0, limit);
  }
}

interface PgObservationRow {
  id: string;
  scope: string;
  key: string;
  content: string;
  tags: string[];
  agent: string;
  created_at: string | Date;
  supersedes: string | null;
  reason: string | null;
  source_event_id: string | null;
  revoked: boolean;
}

function rowToObservation(r: PgObservationRow): Observation {
  return {
    id: r.id,
    scope: r.scope,
    key: r.key,
    content: r.content,
    tags: r.tags ?? [],
    agent: r.agent,
    createdAt: new Date(r.created_at).toISOString(),
    supersedes: r.supersedes,
    reason: r.reason ?? undefined,
    sourceEventId: r.source_event_id ?? undefined,
    revoked: r.revoked,
  };
}

const CURRENT_VIEW_SQL = `
  distinct on (key) id, scope, key, content, tags, agent, created_at,
                    supersedes, reason, source_event_id, revoked
`;

/** Postgres (Neon) scope-aware Third-Mind store. */
export class PostgresThirdMindStore implements ThirdMindStore {
  async write(input: WriteInput): Promise<Observation> {
    await ensureSchema();
    const current = await this.read(input.scope, input.key);
    const { rows } = await getPool().query<PgObservationRow>(
      `insert into observations
         (id, scope, key, content, tags, agent, supersedes, reason, source_event_id, revoked)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
       returning id, scope, key, content, tags, agent, created_at,
                 supersedes, reason, source_event_id, revoked`,
      [
        randomUUID(),
        input.scope,
        input.key,
        input.content,
        input.tags ?? [],
        input.agent ?? "unknown",
        current?.id ?? null,
        input.reason ?? (current ? "superseded" : null),
        input.sourceEventId ?? null,
      ],
    );
    return rowToObservation(rows[0]);
  }

  async read(scope: string, idOrKey: string): Promise<Observation | null> {
    await ensureSchema();
    const byId = await getPool().query<PgObservationRow>(
      `select id, scope, key, content, tags, agent, created_at,
              supersedes, reason, source_event_id, revoked
         from observations
        where scope = $1 and id::text = $2
        limit 1`,
      [scope, idOrKey],
    );
    if (byId.rows[0]) return rowToObservation(byId.rows[0]);
    const { rows } = await getPool().query<PgObservationRow>(
      `select ${CURRENT_VIEW_SQL}
         from observations
        where scope = $1 and key = $2 and not revoked
        order by key, created_at desc
        limit 1`,
      [scope, idOrKey],
    );
    return rows[0] ? rowToObservation(rows[0]) : null;
  }

  async search(scope: string, query: string, limit = 10): Promise<SearchHit[]> {
    await ensureSchema();
    const doc = "key || ' ' || content || ' ' || array_to_string(tags, ' ')";
    const { rows } = await getPool().query<PgObservationRow & { score: number }>(
      `with current as (
         select distinct on (key) id, scope, key, content, tags, agent, created_at,
                supersedes, reason, source_event_id, revoked
           from observations
          where scope = $1 and not revoked
          order by key, created_at desc
       )
       select *,
              ts_rank(to_tsvector('english', ${doc}),
                      websearch_to_tsquery('english', $2)) as score
         from current
        where to_tsvector('english', ${doc}) @@ websearch_to_tsquery('english', $2)
           or ${doc} ilike '%' || $2 || '%'
        order by score desc, created_at desc
        limit $3`,
      [scope, query, limit],
    );
    return rows.map((r) => ({ ...rowToObservation(r), score: Number(r.score) || 0 }));
  }

  async list(scope: string, limit = 50): Promise<Observation[]> {
    await ensureSchema();
    const { rows } = await getPool().query<PgObservationRow>(
      `select ${CURRENT_VIEW_SQL}
         from observations
        where scope = $1 and not revoked
        order by key, created_at desc`,
      [scope],
    );
    return rows
      .map(rowToObservation)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

let singleton: ThirdMindStore | null = null;

/** Shared Third-Mind store instance for tools and the app. */
export function thirdMind(): ThirdMindStore {
  if (!singleton) {
    singleton = hasDatabase()
      ? new PostgresThirdMindStore()
      : new FileThirdMindStore();
  }
  return singleton;
}

/** Fallback scope for unauthenticated/local contexts. */
export const DEFAULT_SCOPE = "ws_local";
