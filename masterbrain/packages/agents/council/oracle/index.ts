// ============================================================
// ORACLE — Implementation
// ============================================================
// Inherits the standard council deliberation contract.
// The persona carries the character; the base class carries the plumbing.
// ============================================================

import { Agent } from '../../base/agent';
import { persona, responsibility } from './persona';

export class Oracle extends Agent {
  constructor() {
    super({
      archetypeId: 'oracle',
      codename: 'ORACLE',
      layer: 'vision',
      persona,
      responsibility,
    });
  }
}
