// ============================================================
// harness/pglite-supabase — the real schema, a thin client
// ============================================================
// PGlite is Postgres compiled to WASM, so the migrations, the
// pgvector column types and the match_canon_patterns RPC all
// execute for real. What is emulated is only the PostgREST wire
// layer — the handful of supabase-js call shapes the code uses.
//
// This deliberately mirrors one PostgREST behaviour that matters:
// `numeric` is returned as a STRING to preserve precision. That is
// the mechanism behind F-07.
// ============================================================

import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Row = Record<string, unknown>;

function toLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length > 0 && typeof v[0] === 'number') return `'[${v.join(',')}]'`; // vector
    // Postgres array-literal syntax rather than ARRAY[...]: an untyped string
    // literal is coerced to the target column type, so an empty list still lands
    // in a uuid[] column. ARRAY[] defaults to text[] and fails the assignment.
    const items = v.map((x) => `"${String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
    return `'{${items}}'`;
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

export async function createPgliteSupabase(migrationsDir: string) {
  const db = new PGlite({ extensions: { vector } });
  await db.waitReady;

  await db.exec(`create extension if not exists vector;`);
  // PGlite ships pgcrypto's gen_random_uuid but not uuid-ossp. The migrations
  // call uuid_generate_v4(), so alias it rather than editing the migration.
  await db.exec(`
    create schema if not exists public;
    create or replace function uuid_generate_v4() returns uuid
      language sql volatile as $$ select gen_random_uuid() $$;
  `);

  // Supabase provisions these roles; a bare Postgres does not. The RLS policies
  // in 0004 grant to them by name, so they have to exist for the migration to
  // apply. This is a harness gap, not a migration defect.
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;
  `);

  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    let sql = readFileSync(join(migrationsDir, f), 'utf8');
    // uuid-ossp / vector are handled above; skip the create-extension lines only.
    sql = sql.replace(/create extension if not exists "uuid-ossp"[^;]*;/gi, '');
    sql = sql.replace(/create extension if not exists "vector"[^;]*;/gi, '');
    try {
      await db.exec(sql);
      console.log(`  migration ${f} — ok`);
    } catch (err) {
      console.error(`  migration ${f} — FAILED: ${(err as Error).message}`);
      throw err;
    }
  }

  // ---- the supabase-js surface the codebase actually uses ----
  function from(table: string) {
    const api = {
      insert(rows: Row | Row[]) {
        const list = Array.isArray(rows) ? rows : [rows];
        const cols = Object.keys(list[0]!).filter((c) => list[0]![c] !== undefined);
        const values = list
          .map((r) => `(${cols.map((c) => toLiteral(r[c])).join(',')})`)
          .join(',');
        const base = `insert into ${table} (${cols.join(',')}) values ${values}`;

        const run = async (returning?: string) => {
          try {
            const res = await db.query<Row>(`${base}${returning ? ` returning ${returning}` : ''}`);
            return { data: res.rows, error: null };
          } catch (e) {
            const msg = (e as Error).message;
            // Surface the SQLSTATE the route now branches on.
            const code = /duplicate key|unique constraint/i.test(msg) ? '23505' : 'XXXXX';
            return { data: null, error: { message: msg, code } };
          }
        };

        return {
          select: (cols2: string) => ({
            single: async () => {
              const r = await run(cols2);
              if (r.error) return r;
              return { data: (r.data as Row[])[0] ?? null, error: null };
            },
          }),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
            run().then(res, rej),
        };
      },

      select(cols: string) {
        const q = { where: [] as string[] };
        const chain = {
          eq(col: string, val: unknown) { q.where.push(`${col} = ${toLiteral(val)}`); return chain; },
          async single() {
            const sql = `select ${cols} from ${table}${q.where.length ? ` where ${q.where.join(' and ')}` : ''} limit 1`;
            const res = await db.query<Row>(sql);
            return res.rows[0]
              ? { data: res.rows[0], error: null }
              : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
          },
        };
        return chain;
      },

      update(patch: Row) {
        const sets = Object.keys(patch).map((c) => `${c} = ${toLiteral(patch[c])}`).join(',');
        const q = { where: [] as string[] };
        const chain = {
          eq(col: string, val: unknown) {
            q.where.push(`${col} = ${toLiteral(val)}`);
            return {
              then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
                db.query(`update ${table} set ${sets} where ${q.where.join(' and ')}`)
                  .then(() => res({ data: null, error: null }), rej),
            };
          },
        };
        return chain;
      },
    };
    return api;
  }

  async function rpc(name: string, args: Record<string, unknown>) {
    if (name === 'match_canon_patterns') {
      const sql = `select * from match_canon_patterns(
        ${toLiteral(args.query_embedding)}::vector(1536),
        ${Number(args.match_threshold)},
        ${Number(args.match_count)},
        ${toLiteral(args.signal_kinds)})`;
      const res = await db.query<Row>(sql);
      return { data: res.rows, error: null };
    }
    if (name === 'increment_prior_usage') {
      await db.query(
        `select increment_prior_usage(${toLiteral(args.prior_ids)}::uuid[], ${Number(args.validated_inc)})`
      );
      return { data: null, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${name}`, code: 'XXXXX' } };
  }

  return { client: { from, rpc } as never, db };
}
