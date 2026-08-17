import type { Reasoner } from "./reasoner";
import { RetrievalReasoner } from "./reasoner";
import { ClaudeReasoner } from "./claude-reasoner";

/**
 * Pick a reasoner from the environment: Claude when the SDK and a credential
 * are both present, extractive retrieval otherwise. Never throws — a missing
 * key degrades the answer, it does not stop the loop.
 */
export async function resolveReasoner(): Promise<Reasoner> {
  if (await ClaudeReasoner.isAvailable()) return new ClaudeReasoner();
  return new RetrievalReasoner();
}
