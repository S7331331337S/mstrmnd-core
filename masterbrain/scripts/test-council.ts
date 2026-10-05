// ============================================================
// scripts/test-council.ts
// ============================================================
// Sanity check: send a test signal through the full loop.
// Run with: pnpm council:test
// ============================================================

import { runLoop } from '@masterbrain/orchestration';

async function main() {
  const result = await runLoop({
    source: 'manual',
    kind: 'pricing_decision',
    severity: 'high',
    context:
      'We are setting the platform take rate for MSTRMND v1. ' +
      'The two real options are 10% (strong premium positioning, lower revenue) ' +
      'and 15% (industry-normal, more margin to invest). Decide.',
    payload: {
      options: ['10%', '15%'],
      market_comps: { cameo: 0.25, onlyfans: 0.2, intro: 0.15 },
      provider_segment: 'AI builders and operators',
      current_stage: 'pre-launch',
    },
  });

  console.log('\n========== DECISION ==========');
  console.log('Title:      ', result.title);
  console.log('Confidence: ', result.confidence);
  console.log('Quorum:     ', result.quorum.join(', '));
  console.log('Priors used:', result.priors_used);
  console.log('Duration:   ', result.duration_ms, 'ms');
  console.log('\n--- Resolution ---');
  console.log(result.resolution);
  console.log('\n--- Reasoning ---');
  console.log(result.reasoning);
  console.log('\n--- Dissent (HEX) ---');
  console.log(result.dissent);
  console.log('\n================================\n');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
