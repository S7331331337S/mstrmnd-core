// ============================================================
// @masterbrain/orchestration — The Closed Loop
// ============================================================
// This is the spine of MASTERBRAIN. It runs the six phases:
//
//   1. INTAKE      — signal arrives, gets normalized
//   2. ROUTING     — NEXUS decides the quorum
//   3. DELIBERATION — quorum + HEX run in parallel with priors from CANON
//   4. SYNTHESIS   — NEXUS writes the decision, dissent, reasoning
//   5. EXECUTION   — decision routes to building agents (Asana, GitHub, etc)
//   6. CLOSURE     — outcome ingested by CANON, patterns extracted
//
// Steps 1–4 are this file. Steps 5–6 live in other packages.
// ============================================================

import type {
  Signal,
  ArchetypeId,
  DeliberationOutput,
  CanonPrior,
} from '@masterbrain/shared';
import {
  instantiateCouncil,
  Nexus,
  Canon,
  Hex,
  Agent,
} from '@masterbrain/agents';
import {
  insertSignal,
  insertDeliberation,
  createDecision,
} from '@masterbrain/db';

export interface RunResult {
  decision_id: string;
  signal_id: string;
  title: string;
  resolution: string;
  reasoning: string;
  dissent: string;
  confidence: number;
  quorum: ArchetypeId[];
  priors_used: number;
  duration_ms: number;
}

// ----------------------------------------------------------------
// Main entry: run the loop for a single signal
// ----------------------------------------------------------------
export async function runLoop(signal: Signal): Promise<RunResult> {
  const started = Date.now();

  // ---------- Phase 1: Intake ----------
  const inserted = await insertSignal({
    source: signal.source,
    source_id: signal.source_id,
    kind: signal.kind,
    severity: signal.severity,
    payload: signal.payload,
    context: signal.context,
  });
  const signal_id = inserted.id;

  // ---------- Phase 2: Routing (NEXUS) ----------
  const nexus = new Nexus();
  const canon = new Canon();

  // ---------- Phase 2 + 3a run concurrently ----------
  // Routing and prior retrieval are independent; the architecture doc always
  // described these as parallel, but they were sequential awaits.
  const [plan, priors] = await Promise.all([
    nexus.route(signal),
    canon.queryPriors(signal, { topK: 5, minSimilarity: 0.7 }),
  ]);

  const quorumIds: ArchetypeId[] = [...plan.primary, ...plan.consulted];

  // A decision synthesized from an empty council is worse than a failed loop:
  // it is written to the ledger with the full confidence machinery and nothing
  // behind it. Fail loudly instead.
  if (quorumIds.length === 0) {
    throw new Error(
      `[runLoop] NEXUS returned an empty quorum for signal kind '${signal.kind}'. ` +
        `Routing reasoning: ${plan.reasoning || '(none given)'}`
    );
  }

  // ---------- Phase 3b: Deliberation (quorum in parallel) ----------
  const council = instantiateCouncil();
  const quorumAgents = quorumIds
    .map((id) => council[id])
    .filter((a): a is Agent => a instanceof Agent);

  const deliberations = await Promise.all(
    quorumAgents.map(async (agent) => {
      try {
        return await agent.deliberate({ signal, priors });
      } catch (err) {
        console.error(`[${agent.codename}] deliberation failed:`, err);
        // One agent's failure should not collapse the council
        return null;
      }
    })
  );
  const validDeliberations = deliberations.filter(
    (d): d is DeliberationOutput => d !== null
  );

  // ---------- Phase 3c: Adversarial review (HEX) ----------
  // HEX runs LAST, after seeing the council's positions
  const hex = new Hex();
  const peersForHex: Partial<Record<ArchetypeId, DeliberationOutput>> = {};
  for (const d of validDeliberations) peersForHex[d.archetype_id] = d;

  const adversary = await hex.deliberate({
    signal,
    priors,
    peers: peersForHex,
  });

  // ---------- Phase 4: Synthesis (NEXUS) ----------
  const synthesis = await nexus.synthesize({
    signal,
    deliberations: validDeliberations.map((d) => ({
      archetype_id: d.archetype_id,
      position: d.position,
      confidence: d.confidence,
    })),
    adversaryPosition: adversary.position,
    priors: priors.map((p) => ({ pattern: p.pattern, confidence: p.confidence })),
  });

  // ---------- Persist ----------
  const decision = await createDecision({
    signal_id,
    title: synthesis.title,
    quorum: quorumIds,
    resolution: synthesis.resolution,
    reasoning: synthesis.reasoning,
    dissent: synthesis.dissent,
    priors_used: priors.map((p) => p.id),
    confidence: synthesis.confidence,
  });

  // Save each deliberation
  await Promise.all([
    ...validDeliberations.map((d) =>
      insertDeliberation({
        decision_id: decision.id,
        archetype_id: d.archetype_id,
        position: d.position,
        confidence: d.confidence,
        reasoning: d.reasoning as unknown as Record<string, unknown>,
      })
    ),
    insertDeliberation({
      decision_id: decision.id,
      archetype_id: 'adversary',
      position: adversary.position,
      confidence: adversary.confidence,
      reasoning: adversary.reasoning as unknown as Record<string, unknown>,
    }),
  ]);

  return {
    decision_id: decision.id,
    signal_id,
    title: synthesis.title,
    resolution: synthesis.resolution,
    reasoning: synthesis.reasoning,
    dissent: synthesis.dissent,
    confidence: synthesis.confidence,
    quorum: quorumIds,
    priors_used: priors.length,
    duration_ms: Date.now() - started,
  };
}

// ----------------------------------------------------------------
// Exports
// ----------------------------------------------------------------
export type { CanonPrior };
