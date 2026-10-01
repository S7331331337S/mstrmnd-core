// ============================================================
// POST /api/canon/ingest
// ============================================================
// Phase 6 of the closed loop. Reality has spoken; CANON learns.
//
// Body: { decision_id, verdict, evidence, metrics? }
//   verdict: 'validated' | 'partial' | 'invalidated' | 'unknown'
//
// CANON will:
//   1. Persist the outcome
//   2. Extract patterns from this case
//   3. Update times_validated counters on the priors that fed this decision
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabase } from '@masterbrain/db';
import { Canon } from '@masterbrain/agents';
import type { Decision } from '@masterbrain/shared';
import { requireToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface IngestBody {
  decision_id: string;
  verdict: 'validated' | 'partial' | 'invalidated' | 'unknown';
  evidence: string;
  metrics?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;

  const body = (await req.json()) as IngestBody;

  // Load the decision
  const { data: decision, error } = await supabase
    .from('decisions')
    .select('*')
    .eq('id', body.decision_id)
    .single();

  if (error || !decision) {
    return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
  }

  // Persist the outcome. `outcomes.decision_id` is UNIQUE, and the insert error
  // used to go unchecked — so a webhook redelivery or a double-fired cron would
  // silently skip this insert, then still bump the prior counters and still run
  // the model to extract a fresh, near-duplicate set of patterns.
  const { error: outcomeError } = await supabase.from('outcomes').insert({
    decision_id: body.decision_id,
    verdict: body.verdict,
    evidence: body.evidence,
    metrics: body.metrics ?? {},
  });

  if (outcomeError) {
    // 23505 = unique_violation: this decision already has a recorded outcome.
    if (outcomeError.code === '23505') {
      return NextResponse.json(
        { error: 'Outcome already recorded for this decision', decision_id: body.decision_id },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: outcomeError.message }, { status: 500 });
  }

  // Update the decision status
  await supabase
    .from('decisions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', body.decision_id);

  // Update priors' validation counters
  if (decision.priors_used && decision.priors_used.length > 0) {
    const inc = body.verdict === 'validated' ? 1 : 0;
    await supabase.rpc('increment_prior_usage', {
      prior_ids: decision.priors_used,
      validated_inc: inc,
    });
  }

  // Extract new patterns from this case
  const canon = new Canon();
  const { patternsExtracted } = await canon.ingestOutcome({
    decision: decision as Decision,
    outcomeVerdict: body.verdict,
    outcomeEvidence: body.evidence,
  });

  return NextResponse.json({
    decision_id: body.decision_id,
    status: 'closed',
    patternsExtracted,
  });
}
