// ============================================================
// Route authentication
// ============================================================
// Every mutating route is gated. This is not optional hardening:
// /api/canon/ingest writes to the pattern store, and those patterns
// are injected into every subsequent council prompt as earned
// wisdom. An open write there is an open write to the system's
// long-term memory.
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env } from '@masterbrain/shared/env';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Bearer-token gate for operator-facing routes.
 * Returns null when the request is authorized, or the response to send when it is not.
 *
 * A missing MASTERBRAIN_API_TOKEN fails closed. An unconfigured deployment
 * refuses to serve rather than serving to everyone.
 */
export function requireToken(req: NextRequest): NextResponse | null {
  const expected = env.API_TOKEN;
  if (!expected) {
    console.error('[auth] MASTERBRAIN_API_TOKEN is not set — refusing to serve');
    return NextResponse.json({ error: 'Server is not configured for authenticated access' }, { status: 503 });
  }

  const header = req.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!presented || !safeEqual(presented, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * HMAC signature gate for webhook routes, using the raw request body.
 * Callers must pass the exact body text they will parse — re-serializing
 * changes the bytes and invalidates the signature.
 */
export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = env.WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const presented = signatureHeader.replace(/^sha256=/, '').trim();
  return safeEqual(digest, presented);
}
