// ============================================================
// POST /api/council/deliberate
// ============================================================
// Lower-level endpoint. Lets you trigger a deliberation without
// going through full intake — useful for testing a quorum,
// debugging an agent, or running ad-hoc council calls.
//
// For the canonical loop, use POST /api/signals/ingest.
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { runLoop } from '@masterbrain/orchestration';
import type { Signal } from '@masterbrain/shared';
import { requireToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;

  const body = (await req.json()) as { signal: Signal };
  if (!body.signal) {
    return NextResponse.json({ error: 'Missing signal' }, { status: 400 });
  }
  const result = await runLoop(body.signal);
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'council/deliberate',
    usage: 'POST { signal: Signal } — runs the full loop end-to-end',
  });
}
