export interface AllianceMember {
  id: string;
  role: "root" | "subagent";
  title: string;
  mandate: string;
  tools: string[];
}

/** The Slice-1 alliance roster (mirrors the eve agent/ directory). */
export const ROSTER: AllianceMember[] = [
  {
    id: "maestro",
    role: "root",
    title: "Maestro",
    mandate:
      "Root orchestrator. Decomposes goals, pulls Third-Mind context, delegates to specialists, executes.",
    tools: [
      "memory_search",
      "memory_write",
      "memory_read",
      "memory_list",
      "execute_code",
      "vgpu",
      "agent",
    ],
  },
  {
    id: "researcher",
    role: "subagent",
    title: "Researcher",
    mandate:
      "Deep research and source synthesis; returns structured evidence briefs with a confidence rating.",
    tools: ["web_search"],
  },
  {
    id: "critic",
    role: "subagent",
    title: "Critic",
    mandate:
      "Adversarial reviewer; surfaces risks and returns a prioritized list of improvements.",
    tools: [],
  },
  {
    id: "memory-keeper",
    role: "subagent",
    title: "Memory-Keeper",
    mandate:
      "Curator of the Third-Mind; decides what is worth remembering and writes durable observations.",
    tools: ["memory_write", "memory_search"],
  },
];
