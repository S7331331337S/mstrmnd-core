// ============================================================
// @masterbrain/agents — Public registry
// ============================================================

import type { ArchetypeId } from '@masterbrain/shared';
import { Agent } from './base/agent';

// Council
import { Axiom } from './council/axiom';
import { Ledger } from './council/ledger';
import { Forge } from './council/forge';
import { Canvas } from './council/canvas';
import { Scout } from './council/scout';
import { Cipher } from './council/cipher';
import { Envoy } from './council/envoy';
import { Vector } from './council/vector';
import { Herald } from './council/herald';
import { Weaver } from './council/weaver';
import { Bard } from './council/bard';
import { Oracle } from './council/oracle';

// Meta
import { Nexus } from './council/nexus';
import { Canon } from './meta/canon';
import { Hex } from './meta/hex';

export { Agent };
export { Nexus, Canon, Hex };

/**
 * The council factory. Returns a fresh instance of each archetype.
 * Singletons aren't safe across requests in Next.js edge runtime.
 */
export function instantiateCouncil(): Record<ArchetypeId, Agent | Nexus | Canon | Hex> {
  return {
    // Council (12)
    strategist:   new Axiom(),
    allocator:    new Ledger(),
    architect:    new Forge(),
    artisan:      new Canvas(),
    researcher:   new Scout(),
    steward:      new Cipher(),
    closer:       new Envoy(),
    grower:       new Vector(),
    herald:       new Herald(),
    connector:    new Weaver(),
    storyteller:  new Bard(),
    oracle:       new Oracle(),
    // Meta (3)
    orchestrator: new Nexus(),
    elder:        new Canon(),
    adversary:    new Hex(),
  };
}

/**
 * Just the deliberating agents (excludes orchestrator/elder).
 * Hex IS included here because it deliberates (adversarially) on every signal.
 */
export function deliberatingAgents(): Record<Exclude<ArchetypeId, 'orchestrator' | 'elder'>, Agent | Hex> {
  return {
    strategist:   new Axiom(),
    allocator:    new Ledger(),
    architect:    new Forge(),
    artisan:      new Canvas(),
    researcher:   new Scout(),
    steward:      new Cipher(),
    closer:       new Envoy(),
    grower:       new Vector(),
    herald:       new Herald(),
    connector:    new Weaver(),
    storyteller:  new Bard(),
    oracle:       new Oracle(),
    adversary:    new Hex(),
  };
}
