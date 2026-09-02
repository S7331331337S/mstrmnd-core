export interface IdentityModel {
  values: string[];
  interests: string[];
  creativePatterns: string[];
}

/** Mirrors `templates/identity.md` — swap for `get_identity` over MCP once wired. */
export const identity: IdentityModel = {
  values: ['quality', 'clarity', 'collaboration'],
  interests: ['product strategy', 'software architecture', 'knowledge systems'],
  creativePatterns: ['hypothesis-driven', 'iteration-focused'],
};

export interface ConnectionStatus {
  id: string;
  label: string;
  detail: string;
  state: 'connected' | 'demo' | 'offline';
}

export const connections: ConnectionStatus[] = [
  { id: 'gateway', label: 'AI Gateway', detail: 'Live model access', state: 'demo' },
  { id: 'hermes', label: 'Hermes Runtime', detail: 'Agent orchestration', state: 'demo' },
  { id: 'vault', label: 'Obsidian Vault', detail: 'Personal memory graph', state: 'demo' },
  { id: 'mcp', label: 'MCP Server', detail: 'search_memory · get_note · get_identity', state: 'demo' },
];
