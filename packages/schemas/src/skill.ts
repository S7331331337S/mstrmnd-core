/**
 * Canonical MSTRMND skill contract. Portable: compile/adapt into Anthropic
 * Skills, AI SDK skills, and other harness formats. Do not fork operational
 * knowledge per provider.
 */
export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  /** When the skill should load (activation reliability target). */
  activation: string[];
  inputs: string[];
  outputs: string[];
  /** Procedure body (markdown, minus frontmatter). */
  body: string;
  policyNotes?: string[];
}

export type SkillAdapterTarget = "canonical" | "claude" | "ai-sdk";

export interface CompiledSkill {
  target: SkillAdapterTarget;
  /** Filename relative to the skill directory */
  filename: string;
  contents: string;
  /** Normalized procedure checksum used for behavioral consistency. */
  checksum: string;
}

export interface SkillAdapterBenchmark {
  skillId: string;
  targets: SkillAdapterTarget[];
  behavioralConsistency: boolean;
  activationPreserved: boolean;
  portability: boolean;
  checksums: Record<string, string>;
  notes: string[];
}
