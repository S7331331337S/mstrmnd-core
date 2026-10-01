// ============================================================
// VECTOR — Implementation
// ============================================================
// Inherits the standard council deliberation contract.
// The persona carries the character; the base class carries the plumbing.
// ============================================================

import { Agent } from '../../base/agent';
import { persona, responsibility } from './persona';

export class Vector extends Agent {
  constructor() {
    super({
      archetypeId: 'grower',
      codename: 'VECTOR',
      layer: 'operating',
      persona,
      responsibility,
    });
  }
}
