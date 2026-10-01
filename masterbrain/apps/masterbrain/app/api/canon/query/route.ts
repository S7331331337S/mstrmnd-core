// ============================================================
// POST /api/canon/query
// ============================================================
// Surface relevant priors for a given signal.
// Useful for debugging routing, eval, and powering the dashboard.
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Canon } from '@masterbrain/agents';
import type { Signal } from '@masterbrain/shared';
import { requireToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;

  const body = (await req.json()) as {
    signal: Signal;
    topK?: number;
    minSimilarity?: number;
  };
  const canon = new Canon();
  const priors = await canon.queryPriors(body.signal, {
    topK: body.topK ?? 5,
    minSimilarity: body.minSimilarity ?? 0.7,
  });
  return NextResponse.json({ priors });
}
