// ============================================================
// harness/run-loop — end-to-end exercise of the closed loop
// ============================================================
import { startFakeAnthropic, type CallLog } from './fake-anthropic';
import { createPgliteSupabase } from './pglite-supabase';
import { join } from 'node:path';

const calls: CallLog[] = [];

async function main() {
  console.log('\n=== Booting Postgres (PGlite + pgvector) and applying migrations ===');
  const { client, db } = await createPgliteSupabase(join(process.cwd(), 'packages/db/migrations'));

  const { url, server } = await startFakeAnthropic(calls);
  process.env.ANTHROPIC_BASE_URL = url;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-harness';

  // Imported after env is set so the SDK picks up the base URL.
  const { __setClient } = await import('@masterbrain/db');
  __setClient(client);
  const { runLoop } = await import('@masterbrain/orchestration');

  console.log('\n=== Running the loop ===');
  const started = Date.now();
  const result = await runLoop({
    source: 'manual',
    kind: 'pricing_decision',
    severity: 'high',
    context:
      'We are setting the platform take rate for MSTRMND v1. The two real options are ' +
      '10% (strong premium positioning, lower revenue) and 15% (industry-normal, more margin).',
    payload: {
      options: ['10%', '15%'],
      market_comps: { cameo: 0.25, onlyfans: 0.2, intro: 0.15 },
      current_stage: 'pre-launch',
    },
  });

  console.log('\n=== DECISION ===');
  console.log('Title      :', result.title);
  console.log('Confidence :', result.confidence);
  console.log('Quorum     :', result.quorum.join(', '));
  console.log('Priors used:', result.priors_used);
  console.log('Wall clock :', Date.now() - started, 'ms');
  console.log('\nResolution :', result.resolution);
  console.log('\nDissent    :', result.dissent.slice(0, 160) + '…');

  console.log('\n=== Model calls actually made ===');
  const byModel = calls.reduce<Record<string, number>>((acc, c) => {
    const k = `${c.model}  (${c.role})`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  for (const [k, n] of Object.entries(byModel)) console.log(`  ${n}×  ${k}`);

  // ---------- Phase 6: closure ----------
  console.log('\n=== Phase 6: closing the loop ===');
  const { Canon } = await import('@masterbrain/agents');
  const dec = await db.query<Record<string, unknown>>(
    `select * from decisions where id = '${result.decision_id}'`
  );
  const canon = new Canon();
  const ingest = await canon.ingestOutcome({
    decision: dec.rows[0] as never,
    outcomeVerdict: 'validated',
    outcomeEvidence: 'Launched at 10%. 340 providers onboarded in 60 days, churn under 4%.',
  });
  console.log('  patterns extracted:', ingest.patternsExtracted);

  // ---------- assertions against the real tables ----------
  console.log('\n=== Ledger state (queried from Postgres) ===');
  for (const t of ['signals', 'decisions', 'deliberations', 'canon_patterns', 'agent_invocations']) {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from ${t}`);
    console.log(`  ${t.padEnd(20)} ${r.rows[0]!.n}`);
  }

  const view = await db.query<Record<string, unknown>>(
    `select agent_codename, deliberations_count, avg_latency_ms, total_tokens_out
       from council_activity where deliberations_count > 0 order by agent_codename`
  );
  console.log('\n=== council_activity view (F-06) ===');
  for (const r of view.rows) {
    console.log(
      `  ${String(r.agent_codename).padEnd(8)} delibs=${r.deliberations_count}` +
      `  avg_latency=${r.avg_latency_ms ?? 'NULL'}  tokens_out=${r.total_tokens_out ?? 'NULL'}`
    );
  }

  const conf = await db.query<Record<string, unknown>>(
    `select confidence from decisions limit 1`
  );
  console.log('\n=== F-07 check: numeric over the wire ===');
  console.log(`  decisions.confidence = ${JSON.stringify(conf.rows[0]!.confidence)} (typeof ${typeof conf.rows[0]!.confidence})`);

  server.close();
}

main().catch((err) => {
  console.error('\nHARNESS FAILED:', err);
  process.exit(1);
});
