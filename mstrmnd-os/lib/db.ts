import { Pool, type PoolClient } from "pg";

/**
 * Shared Postgres pool (Neon in production, any Postgres locally). The whole
 * data layer is gated on `DATABASE_URL`: when it is set, users and the
 * Third-Mind persist in Postgres; otherwise they fall back to the file-backed
 * dev stores. The same schema works on Neon and a local Postgres.
 */

/**
 * Resolve a Postgres connection string, accepting the common names set by the
 * Neon / Vercel Postgres integrations so no renaming is needed on deploy.
 */
export function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING
  );
}

export function hasDatabase(): boolean {
  return !!databaseUrl();
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = databaseUrl();
    const needsSsl =
      !!connectionString &&
      (/sslmode=require/i.test(connectionString) ||
        /neon\.tech/i.test(connectionString) ||
        process.env.PGSSL === "1");
    pool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return pool;
}

const SCHEMA_SQL = `
create table if not exists users (
  id uuid primary key,
  email text unique not null,
  name text not null,
  password_hash text not null,
  workspace_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists observations (
  id uuid primary key,
  scope text not null,
  key text not null,
  content text not null,
  tags text[] not null default '{}',
  agent text not null,
  created_at timestamptz not null default now(),
  unique (scope, key)
);

create index if not exists observations_scope_created_idx
  on observations (scope, created_at desc);
`;

let schemaReady: Promise<void> | null = null;

/**
 * Idempotently ensure the schema exists (runs once per process).
 *
 * When both tables already exist we skip the DDL entirely: the least-privilege
 * app role (mstrmnd_app, see db/migrations) has no CREATE on the schema, and
 * `create table if not exists` still checks that privilege. Fresh/dev
 * databases (connected as an owner) still get bootstrapped here.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = getPool();
      const { rows } = await pool.query<{ ready: boolean }>(
        `select to_regclass('public.users') is not null
            and to_regclass('public.observations') is not null as ready`,
      );
      if (!rows[0]?.ready) await pool.query(SCHEMA_SQL);
    })().catch((err) => {
      schemaReady = null; // allow retry on transient failure
      throw err;
    });
  }
  return schemaReady;
}

/** Shared scope for local dev / CI only. Never used in production. */
export const DEV_WORKSPACE = "ws_local";

/**
 * Resolve the workspace a query runs under. A real workspace id passes
 * through. A missing one falls back to the shared dev scope only outside
 * production; in production it throws, so an unauthenticated code path can
 * never read or write a shared bucket.
 */
export function resolveWorkspaceId(
  workspaceId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  const ws = typeof workspaceId === "string" ? workspaceId.trim() : "";
  if (ws) return ws;
  if (env.NODE_ENV === "production") {
    throw new Error("No workspace in context; refusing to run a workspace-scoped query in production.");
  }
  return DEV_WORKSPACE;
}

/**
 * Run `fn` inside one transaction whose `app.workspace_id` is set
 * (transaction-local), so the RLS policies in db/migrations/0001_rls.sql
 * scope every statement to that workspace. Works with the pooled `pg` driver
 * and Neon's transaction-mode pooler, because set_config(..., true) and the
 * queries share one transaction on one connection. Harmless while the app
 * still connects as the owner (BYPASSRLS): the app-level filters still apply.
 */
export async function withWorkspace<T>(
  workspaceId: string | null | undefined,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const ws = resolveWorkspaceId(workspaceId);
  const client = await getPool().connect();
  let broken: Error | undefined;
  try {
    await client.query("begin");
    await client.query("select set_config('app.workspace_id', $1, true)", [ws]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch (rollbackErr) {
      broken = rollbackErr as Error; // discard this connection instead of reusing it
    }
    throw err;
  } finally {
    client.release(broken);
  }
}
