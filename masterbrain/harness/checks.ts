// ============================================================
// harness/checks — prove each fix, and each original failure
// ============================================================
import { startFakeAnthropic, type CallLog } from './fake-anthropic';
import { createPgliteSupabase } from './pglite-supabase';
import { join } from 'node:path';

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}\n        ${detail}`);
};

async function main() {
  const calls: CallLog[] = [];
  const { url, server } = await startFakeAnthropic(calls);
  process.env.ANTHROPIC_BASE_URL = url;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-harness';

  const { client, db } = await createPgliteSupabase(join(process.cwd(), 'packages/db/migrations'));
  const { __setClient } = await import('@masterbrain/db');
  __setClient(client);

  console.log('\n────────── F-01  model ids ──────────');
  {
    // The original defaults, against a server that enforces the real allowlist.
    process.env.COUNCIL_MODEL = 'claude-opus-4-7';
    const { Agent } = await import('@masterbrain/agents');
    class Probe extends (Agent as never as new (d: unknown) => { deliberate: (i: unknown) => Promise<unknown> }) {}
    let msg = '';
    try {
      const a = new Probe({
        archetypeId: 'strategist', codename: 'AXIOM', layer: 'capital',
        persona: 'You are AXIOM.', responsibility: 'strategy', model: 'claude-opus-4-7',
      });
      await a.deliberate({ signal: { source: 'manual', kind: 'k', severity: 'low', payload: {} }, priors: [] });
    } catch (e) { msg = (e as Error).message; }
    check('original id claude-opus-4-7 is rejected by the API',
      /404|not_found/i.test(msg), msg.split('\n')[0]?.slice(0, 100) || '(no error — unexpected)');

    let ok = false;
    try {
      const a = new Probe({
        archetypeId: 'strategist', codename: 'AXIOM', layer: 'capital',
        persona: 'You are AXIOM.', responsibility: 'strategy', model: 'claude-opus-5',
      });
      await a.deliberate({ signal: { source: 'manual', kind: 'k', severity: 'low', payload: {} }, priors: [] });
      ok = true;
    } catch (e) { msg = (e as Error).message; }
    check('corrected id claude-opus-5 is accepted', ok, ok ? 'deliberation returned a parsed position' : msg);
    delete process.env.COUNCIL_MODEL;
  }

  console.log('\n────────── F-08  routing validation ──────────');
  {
    process.env.HARNESS_BAD_ROUTING = '1';
    const { Nexus } = await import('@masterbrain/agents');
    const plan = await new Nexus().route({ source: 'manual', kind: 'pricing_decision', severity: 'high', payload: {} });
    const all = [...plan.primary, ...plan.consulted];
    check('meta roles and unknown ids are dropped from the quorum',
      !all.includes('adversary' as never) && !all.includes('elder' as never) && !all.includes('chief_vibes_officer' as never),
      `model returned [allocator, adversary, elder, chief_vibes_officer, closer] -> quorum ${JSON.stringify(all)}`);

    // Everything invalid => empty quorum => the loop must refuse, not synthesize.
    process.env.HARNESS_BAD_ROUTING = '2';
    const { runLoop } = await import('@masterbrain/orchestration');
    let threw = '';
    try {
      await runLoop({ source: 'manual', kind: 'pricing_decision', severity: 'low', payload: {} });
    } catch (e) { threw = (e as Error).message; }
    check('an empty quorum fails the loop instead of writing a hollow decision',
      /empty quorum/i.test(threw), threw.slice(0, 120) || '(loop completed — a decision was written with no council)');
    delete process.env.HARNESS_BAD_ROUTING;
  }

  console.log('\n────────── F-03  row level security ──────────');
  {
    const probe = async (sql: string) => {
      try { await db.exec(`set local role anon; ${sql}`); return 'ALLOWED'; }
      catch (e) { return (e as Error).message.slice(0, 60); }
      finally { await db.exec('reset role'); }
    };
    const read = await probe('select * from canon_patterns');
    const write = await probe(`insert into canon_patterns (pattern, signal_kinds, source_decisions, confidence)
                               values ('poisoned prior', '{pricing_decision}', '{}', 0.99)`);
    check('anon cannot read canon_patterns', read !== 'ALLOWED', `anon select -> ${read}`);
    check('anon cannot write canon_patterns', write !== 'ALLOWED', `anon insert -> ${write}`);
    const roster = await probe('select * from archetypes');
    check('anon can still read the archetype roster (reference data)', roster === 'ALLOWED', `anon select -> ${roster}`);
  }

  console.log('\n────────── F-07  numeric over the wire ──────────');
  {
    await db.exec(`insert into decisions (signal_id, title, quorum, resolution, reasoning, dissent, priors_used, confidence, status)
                   values (null, 't', '{strategist}', 'r', 'why', 'd', '{}', 0.83, 'synthesized')`);
    const r = await db.query<{ confidence: unknown }>(`select confidence from decisions limit 1`);
    const raw = r.rows[0]!.confidence;
    check('numeric arrives as a string, so .toFixed() on it would throw',
      typeof raw === 'string',
      `confidence = ${JSON.stringify(raw)} (typeof ${typeof raw}) — the RPC now casts to float8`);
  }

  console.log('\n────────── F-05  kind is a boost, not a gate ──────────');
  {
    const emb = (seed: number) => `'[${Array.from({ length: 1536 }, (_, i) => (i === seed ? 1 : 0)).join(',')}]'`;
    await db.exec(`insert into canon_patterns (pattern, signal_kinds, source_decisions, confidence, embedding)
                   values ('same-kind prior',  '{pricing_decision}', '{}', 0.8, ${emb(0)}),
                          ('cross-kind prior', '{margin_review}',    '{}', 0.8, ${emb(0)})`);
    const hits = await db.query<{ pattern: string }>(
      `select pattern from match_canon_patterns(${emb(0)}::vector(1536), 0.5, 10, '{pricing_decision}')`
    );
    const names = hits.rows.map((h) => h.pattern);
    check('a differently-tagged prior is still retrievable',
      names.includes('cross-kind prior'),
      `query kind=pricing_decision -> ${JSON.stringify(names)}`);
    check('the same-kind prior still ranks first',
      names[0] === 'same-kind prior', `ranking -> ${JSON.stringify(names)}`);
  }

  console.log('\n────────── F-04  what the old embedding actually did ──────────');
  {
    const pseudo = (text: string, dim = 1536) => {
      const v = new Array(dim).fill(0);
      for (let i = 0; i < text.length; i++) v[i % dim] += text.charCodeAt(i) / 256;
      const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / n);
    };
    const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
    const corpus = {
      pricing1:  'kind=pricing_decision severity=high Setting the v1 take rate, 10 or 15 percent?',
      pricing2:  'kind=pricing_decision severity=high What take rate do we launch at, ten or fifteen?',
      pricing3:  'kind=pricing_question severity=medium Should the platform fee be 10% or 15% at launch?',
      incident1: 'kind=incident severity=high The production database is down, customers cannot log in.',
      incident2: 'kind=incident severity=critical Postgres primary failed over, writes are erroring.',
      hiring:    'kind=hiring severity=low Should we open a second design role before the seed closes?',
    };
    const keys = Object.keys(corpus) as Array<keyof typeof corpus>;
    const vecs = Object.fromEntries(keys.map((k) => [k, pseudo(corpus[k])])) as Record<string, number[]>;
    const topic = (k: string) => k.replace(/\d$/, '');

    const same: number[] = [];
    const diff: number[] = [];
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = keys[i]!, b = keys[j]!;
        const sim = cos(vecs[a]!, vecs[b]!);
        (topic(a) === topic(b) ? same : diff).push(sim);
      }
    }
    const all = [...same, ...diff];
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const separation = mean(same) - mean(diff);
    const weakestSame = Math.min(...same);
    const outranking = diff.filter((d) => d > weakestSame).length;

    check('the 0.70 threshold filters nothing',
      all.every((s) => s > 0.7),
      `all ${all.length} pairs land in ${Math.min(...all).toFixed(4)}–${Math.max(...all).toFixed(4)}`);

    check('similarity carries no usable signal about meaning',
      separation < 0.05,
      `same-topic mean ${mean(same).toFixed(4)} vs different-topic mean ${mean(diff).toFixed(4)} ` +
      `— separation ${separation.toFixed(4)}; ${outranking}/${diff.length} unrelated pairs outrank the weakest related pair`);

    const { Canon } = await import('@masterbrain/agents');
    const priors = await new Canon().queryPriors(
      { source: 'manual', kind: 'pricing_decision', severity: 'high', payload: {} }, { topK: 5 }
    );
    check('CANON now returns nothing rather than something arbitrary',
      priors.length === 0, `queryPriors -> ${priors.length} priors with no provider configured`);
  }

  server.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n══════ ${results.length - failed.length}/${results.length} checks passed ══════`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CHECKS FAILED:', e); process.exit(1); });
