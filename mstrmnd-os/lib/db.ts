import { Pool } from "pg";

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

/** Idempotently ensure the schema exists (runs once per process). */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null; // allow retry on transient failure
        throw err;
      });
  }
  return schemaReady;
}
