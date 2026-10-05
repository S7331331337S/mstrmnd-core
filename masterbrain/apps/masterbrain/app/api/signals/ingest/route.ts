// ============================================================
// POST /api/signals/ingest
// ============================================================
// The main entry point. Any signal source (manual, webhook,
// scheduled) hits this endpoint. It validates, runs the loop,
// and returns the synthesized decision.
//
// For long-running signals, use the /async variant (TODO):
// queue to Vercel cron or a background queue.
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { runLoop } from '@masterbrain/orchestration';
import type { Signal } from '@masterbrain/shared';
import { requireToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60; // seconds — Vercel hobby caps; bump on pro

interface IngestBody {
  source: Signal['source'];
  source_id?: string;
  kind: string;
  severity?: Signal['severity'];
  payload: Record<string, unknown>;
  context?: string;
}

export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;

  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Lightweight validation
  if (!body.source || !body.kind || !body.payload) {
    return NextResponse.json(
      { error: 'Missing required fields: source, kind, payload' },
      { status: 400 }
    );
  }

  const signal: Signal = {
    source: body.source,
    source_id: body.source_id,
    kind: body.kind,
    severity: body.severity ?? 'medium',
    payload: body.payload,
    context: body.context,
  };

  try {
    const result = await runLoop(signal);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/signals/ingest] runLoop failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Loop failed' },
      { status: 500 }
    );
  }
}

// Health probe
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'signals/ingest' });
}
