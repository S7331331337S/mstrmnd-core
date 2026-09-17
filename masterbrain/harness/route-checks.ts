// ============================================================
// harness/route-checks — the routes, not a model of the routes
// ============================================================
import { startFakeAnthropic, type CallLog } from './fake-anthropic';
import { createPgliteSupabase } from './pglite-supabase';
import { join } from 'node:path';

const results: Array<{ name: string; pass: boolean }> = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`);
};

const post = (url: string, body: unknown, token?: string) =>
  new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

async function main() {
  const calls: CallLog[] = [];
  const { url, server } = await startFakeAnthropic(calls);
  process.env.ANTHROPIC_BASE_URL = url;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-harness';

  const { client, db } = await createPgliteSupabase(join(process.cwd(), 'packages/db/migrations'));
  const { __setClient } = await import('@masterbrain/db');
  __setClient(client);

  const signal = { source: 'manual', kind: 'pricing_decision', severity: 'high', payload: { options: ['10%', '15%'] } };

  console.log('\n────────── F-02  route authentication ──────────');

  // Unconfigured deployment must fail closed, not open.
  delete process.env.MASTERBRAIN_API_TOKEN;
  {
    const { POST } = await import('@/app/api/signals/ingest/route');
    const res = await POST(post('http://x/api/signals/ingest', signal) as never);
    check('unconfigured deployment refuses to serve rather than serving everyone',
      res.status === 503, `no MASTERBRAIN_API_TOKEN -> ${res.status} ${JSON.stringify(await res.json())}`);
  }

  process.env.MASTERBRAIN_API_TOKEN = 'correct-horse-battery-staple';
  const before = calls.length;
  {
    const { POST } = await import('@/app/api/signals/ingest/route');
    const res = await POST(post('http://x/api/signals/ingest', signal) as never);
    check('anonymous council run is rejected',
      res.status === 401, `no Authorization header -> ${res.status}`);
    check('rejection costs zero model calls',
      calls.length === before, `model calls made while unauthenticated: ${calls.length - before}`);

    const bad = await POST(post('http://x/api/signals/ingest', signal, 'wrong-token') as never);
    check('a wrong token is rejected', bad.status === 401, `wrong bearer -> ${bad.status}`);
  }

  console.log('\n────────── F-02  memory write is gated ──────────');
  {
    const { POST } = await import('@/app/api/canon/ingest/route');
    const res = await POST(post('http://x/api/canon/ingest', {
      decision_id: '00000000-0000-0000-0000-000000000000',
      verdict: 'validated',
      evidence: 'poisoned prior injected by an anonymous caller',
    }) as never);
    check('anonymous write to the pattern store is rejected',
      res.status === 401, `unauthenticated canon/ingest -> ${res.status}`);
  }

  console.log('\n────────── authorized path still works ──────────');
  let decisionId = '';
  {
    const { POST } = await import('@/app/api/signals/ingest/route');
    const res = await POST(post('http://x/api/signals/ingest', signal, 'correct-horse-battery-staple') as never);
    const json = await res.json() as { decision_id: string; title: string };
    decisionId = json.decision_id;
    check('authorized council run completes',
      res.status === 200 && !!json.decision_id, `${res.status} — "${json.title}"`);
  }

  console.log('\n────────── F-09  outcome ingestion is idempotent ──────────');
  {
    const { POST } = await import('@/app/api/canon/ingest/route');
    const payload = { decision_id: decisionId, verdict: 'validated', evidence: 'Launched at 10%; 340 providers in 60 days.' };
    const first = await POST(post('http://x/api/canon/ingest', payload, 'correct-horse-battery-staple') as never);
    const firstJson = await first.json() as { patternsExtracted: number };
    const afterFirst = await db.query<{ n: number }>('select count(*)::int as n from canon_patterns');

    const second = await POST(post('http://x/api/canon/ingest', payload, 'correct-horse-battery-staple') as never);
    const afterSecond = await db.query<{ n: number }>('select count(*)::int as n from canon_patterns');

    check('first ingest records the outcome and extracts patterns',
      first.status === 200, `${first.status}, patterns extracted: ${firstJson.patternsExtracted}`);
    check('replayed ingest returns 409 instead of silently re-learning',
      second.status === 409, `replay -> ${second.status} ${JSON.stringify(await second.json())}`);
    check('replay did not duplicate patterns',
      afterFirst.rows[0]!.n === afterSecond.rows[0]!.n,
      `canon_patterns: ${afterFirst.rows[0]!.n} after first, ${afterSecond.rows[0]!.n} after replay`);
  }

  server.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n══════ ${results.length - failed.length}/${results.length} route checks passed ══════`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('ROUTE CHECKS FAILED:', e); process.exit(1); });
