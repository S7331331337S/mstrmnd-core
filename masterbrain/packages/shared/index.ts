// ============================================================
// @masterbrain/shared — Shared types
// ============================================================

export type Layer = 'capital' | 'building' | 'operating' | 'network' | 'vision' | 'meta';

export type ArchetypeId =
  | 'allocator' | 'strategist'                            // capital
  | 'architect' | 'artisan' | 'researcher'                // building
  | 'steward' | 'closer' | 'grower'                       // operating
  | 'herald' | 'connector' | 'storyteller'                // network
  | 'oracle'                                              // vision
  | 'orchestrator' | 'elder' | 'adversary';               // meta

export type AgentCodename =
  | 'LEDGER' | 'AXIOM'
  | 'FORGE' | 'CANVAS' | 'SCOUT'
  | 'CIPHER' | 'ENVOY' | 'VECTOR'
  | 'HERALD' | 'WEAVER' | 'BARD'
  | 'ORACLE'
  | 'NEXUS' | 'CANON' | 'HEX';

export type SignalSource = 'asana' | 'github' | 'slack' | 'webhook' | 'manual' | 'scheduled';
export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Signal {
  id?: string;
  source: SignalSource;
  source_id?: string;
  kind: string;
  severity: SignalSeverity;
  payload: Record<string, unknown>;
  context?: string;
  ingested_at?: string;
}

export interface DeliberationOutput {
  archetype_id: ArchetypeId;
  position: string;
  confidence: number; // 0-1
  reasoning: {
    assumptions: string[];
    evidence: string[];
    tradeoffs: string[];
  };
}

export interface CanonPrior {
  id: string;
  pattern: string;
  confidence: number;
  similarity: number;
  source_decisions: string[];
}

export interface Decision {
  id: string;
  signal_id: string;
  title: string;
  status: 'pending' | 'deliberating' | 'synthesized' | 'executing' | 'closed' | 'overridden';
  quorum: ArchetypeId[];
  resolution: string;
  reasoning: string;
  dissent: string;
  priors_used: string[];
  confidence: number;
  created_at: string;
}

export interface QuorumPlan {
  primary: ArchetypeId[];     // archetypes whose voice is core to this decision
  consulted: ArchetypeId[];   // archetypes who weigh in if relevant
  reasoning: string;          // why this quorum
}
