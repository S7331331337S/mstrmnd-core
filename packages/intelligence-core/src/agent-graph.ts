import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AgentGraphEntry {
  id: string;
  role: string;
  subAgents?: string[];
}

export interface AgentGraph {
  schemaVersion: string;
  agents: AgentGraphEntry[];
}

export function loadAgentGraph(repoRoot: string): AgentGraph | null {
  const path = join(repoRoot, "templates", "operator-pack", "agent-graph.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as AgentGraph;
    if (!Array.isArray(parsed.agents)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Missing graph means all built-in specs remain enabled. */
export function graphIncludes(graph: AgentGraph | null, agentId: string): boolean {
  if (!graph) return true;
  return graph.agents.some((a) => a.id === agentId);
}
