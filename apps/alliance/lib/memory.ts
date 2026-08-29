export interface MemoryNode {
  id: string;
  type: 'memory' | 'concept' | 'artifact';
  title: string;
  content: string;
  confidence: number;
  relationships: string[];
}

/**
 * Demo memory graph. Shapes match `@mstrmnd/schemas`' `MemoryNode` — swap
 * this for a live call into `@mstrmnd/mcp-server`'s `search_memory` tool
 * once the mobile client is wired to a running Hermes instance.
 */
export const memoryNodes: MemoryNode[] = [
  {
    id: 'identity-profile',
    type: 'concept',
    title: 'Identity Profile',
    content:
      'Values: autonomy, clarity, craft. Interests: logistics, AI systems, personal knowledge. Prefers direct communication and dark mode interfaces.',
    confidence: 0.94,
    relationships: ['vault-map', 'brand-system'],
  },
  {
    id: 'brand-system',
    type: 'artifact',
    title: 'Brand System — Obsidian / Platinum',
    content:
      'One accent only: Platinum #e8e2d0 over Obsidian #0a0a0b. No second hue. Sharp 3px radius. Inter + IBM Plex Mono.',
    confidence: 0.98,
    relationships: ['identity-profile', 'editorial-engine'],
  },
  {
    id: 'editorial-engine',
    type: 'artifact',
    title: 'MSTRMND // PRESS Editorial Engine',
    content:
      'Draft → user approves → publish. Human-approval gate is a hard stop. Nothing auto-publishes. Signal ping on publish.',
    confidence: 0.91,
    relationships: ['brand-system', 'hermes-runtime'],
  },
  {
    id: 'hermes-runtime',
    type: 'concept',
    title: 'Hermes Agent Runtime',
    content:
      'Orchestrating agent loop over the personal memory graph. Loads the Obsidian vault, resolves identity, indexes notes.',
    confidence: 0.88,
    relationships: ['editorial-engine', 'mcp-interface'],
  },
  {
    id: 'mcp-interface',
    type: 'concept',
    title: 'MCP Interface Layer',
    content:
      'Exposes search_memory, get_note, and get_identity tools over the Model Context Protocol for editor integrations.',
    confidence: 0.85,
    relationships: ['hermes-runtime'],
  },
  {
    id: 'vault-map',
    type: 'memory',
    title: 'iCloud Vault Map',
    content:
      'Digest notes generated from iCloud/local folders into the Obsidian vault via scripts/sync-vault-map.py.',
    confidence: 0.72,
    relationships: ['identity-profile'],
  },
];

export function searchMemory(query: string): MemoryNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return memoryNodes;
  return memoryNodes.filter(
    (node) => node.title.toLowerCase().includes(q) || node.content.toLowerCase().includes(q),
  );
}
