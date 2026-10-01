// ============================================================
// AXIOM — Implementation
// ============================================================
// Inherits the standard council deliberation contract.
// The persona carries the character; the base class carries the plumbing.
// ============================================================

import { Agent } from '../../base/agent';
import { persona, responsibility } from './persona';

export class Axiom extends Agent {
  constructor() {
    super({
      archetypeId: 'strategist',
      codename: 'AXIOM',
      layer: 'capital',
      persona,
      responsibility,
    });
  }
}
