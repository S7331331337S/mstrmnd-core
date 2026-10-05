// ============================================================
// @masterbrain/db — Supabase client + helpers
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@masterbrain/shared/env';
import type { ArchetypeId } from '@masterbrain/shared';

let _client: SupabaseClient | null = null;

/**
 * Test seam. Lets a harness drive the real query helpers against a real
 * Postgres without a Supabase project. Production never calls this.
 *
 * Anchored on globalThis rather than a module-local: under pnpm the package can
 * resolve both through the workspace symlink and through the tsconfig path,
 * which yields two module instances and a module-local override only one of
 * them would see.
 */
const OVERRIDE = Symbol.for('masterbrain.db.override');

export function __setClient(client: SupabaseClient | null): void {
  (globalThis as Record<symbol, unknown>)[OVERRIDE] = client;
  _client = null;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const _override = (globalThis as Record<symbol, unknown>)[OVERRIDE] as SupabaseClient | null;
    if (_override) return Reflect.get(_override, prop);
    if (!_client) {
      _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
    }
    return Reflect.get(_client, prop);
  },
});

// ----------------------------------------------------------------
// Telemetry: agent invocation log
// ----------------------------------------------------------------
export async function recordInvocation(row: {
  archetype_id: ArchetypeId;
  decision_id?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  model: string;
  cached?: boolean;
  succeeded?: boolean;
  error?: string;
}): Promise<void> {
  try {
    await supabase.from('agent_invocations').insert(row);
  } catch (err) {
    // Telemetry failures should never block real work.
    console.error('[db] recordInvocation failed:', err);
  }
}

// ----------------------------------------------------------------
// Convenience: signal ingestion
// ----------------------------------------------------------------
export async function insertSignal(signal: {
  source: string;
  source_id?: string;
  kind: string;
  severity: string;
  payload: Record<string, unknown>;
  context?: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('signals')
    .insert(signal)
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function insertDeliberation(row: {
  decision_id: string;
  archetype_id: ArchetypeId;
  position: string;
  confidence: number;
  reasoning: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('deliberations').insert(row);
  if (error) throw error;
}

export async function createDecision(row: {
  signal_id: string;
  title: string;
  quorum: ArchetypeId[];
  resolution: string;
  reasoning: string;
  dissent: string;
  priors_used: string[];
  confidence: number;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('decisions')
    .insert({ ...row, status: 'synthesized', synthesized_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}
