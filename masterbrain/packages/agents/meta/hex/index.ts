// ============================================================
// HEX — Implementation
// ============================================================
// HEX inherits the base Agent contract but overrides `buildPrompt`
// because its job is structurally different: it argues AGAINST
// the emerging consensus, not for an independent position.
// ============================================================

import { Agent, type DeliberateInput } from '../../base/agent';
import { persona, responsibility } from './persona';
import { env } from '@masterbrain/shared/env';

export class Hex extends Agent {
  constructor() {
    super({
      archetypeId: 'adversary',
      codename: 'HEX',
      layer: 'meta',
      persona,
      responsibility,
      model: env.ADVERSARY_MODEL,
    });
  }

  /**
   * HEX is always invoked AFTER the council deliberates.
   * It reads the peers and produces the strongest argument against.
   */
  protected override buildPrompt(input: DeliberateInput): string {
    const peers = input.peers ?? {};
    const peerSummaries = Object.entries(peers)
      .filter(([, p]) => p)
      .map(([id, p]) => `**${id}** (conf ${p!.confidence.toFixed(2)}): ${p!.position}`)
      .join('\n');

    const parts: string[] = [];

    parts.push('# Signal under deliberation');
    parts.push(`Kind: ${input.signal.kind}`);
    parts.push(`Severity: ${input.signal.severity}`);
    if (input.signal.context) parts.push(`\nContext: ${input.signal.context}`);

    parts.push('\n# The council\'s emerging position');
    parts.push(peerSummaries || '(no peer positions provided)');

    if (input.priors.length > 0) {
      parts.push('\n# Relevant priors');
      for (const p of input.priors) {
        parts.push(`- [${p.confidence.toFixed(2)}] ${p.pattern}`);
      }
    }

    parts.push('\n# Your adversarial argument');
    parts.push('Argue against the emerging position. Strongest case for "no."');
    parts.push('What is the council not seeing? What pattern from CANON is being ignored?');
    parts.push('What does the failure mode look like in 6, 12, 24 months?');
    parts.push('Be specific. Be short. Be hard.');
    parts.push('');
    parts.push('If after honest examination you find no real argument against, say so — but the bar is high.');
    parts.push('Return the JSON.');

    return parts.join('\n');
  }
}
