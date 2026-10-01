// ============================================================
// scripts/migrate — apply migrations in order
// ============================================================
// Referenced by `pnpm db:migrate`, which previously pointed at a
// file that did not exist.
// ============================================================

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const DIR = join(process.cwd(), 'packages/db/migrations');

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('Set SUPABASE_DB_URL to the project connection string (Settings → Database).');

  const client = new Client({ connectionString: url });
  await client.connect();

  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz default now()
    );
  `);

  const applied = new Set(
    (await client.query<{ name: string }>('select name from _migrations')).rows.map((r) => r.name)
  );

  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }
    const sql = readFileSync(join(DIR, file), 'utf8');
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`  ok    ${file}`);
    } catch (err) {
      await client.query('rollback');
      console.error(`  FAIL  ${file}: ${(err as Error).message}`);
      throw err;
    }
  }

  await client.end();
  console.log('\nMigrations up to date.');
}

main().catch((err) => { console.error(err); process.exit(1); });
