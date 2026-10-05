// ============================================================
// scripts/seed — archetype roster only
// ============================================================
// The roster lives in 0002_seed_archetypes.sql and is applied by
// `db:migrate`. This script re-asserts it idempotently, for a
// database whose roster drifted without a full re-migration.
// ============================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('Set SUPABASE_DB_URL to the project connection string.');

  const sql = readFileSync(join(process.cwd(), 'packages/db/migrations/0002_seed_archetypes.sql'), 'utf8')
    // The seed is written as a plain insert; make re-running it safe.
    .replace(/;\s*$/, ' on conflict (id) do update set\n' +
      '  name = excluded.name,\n' +
      '  agent_codename = excluded.agent_codename,\n' +
      '  layer = excluded.layer,\n' +
      '  responsibility = excluded.responsibility;');

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query<{ n: string }>('select count(*) as n from archetypes');
  await client.end();
  console.log(`Roster seeded: ${rows[0]!.n} archetypes.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
