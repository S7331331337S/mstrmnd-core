/**
 * Parallel Council — a durable, checkpointed multi-agent pattern.
 *
 * Fans a question out to several perspectives as independent durable steps,
 * then synthesizes them. Each `"use step"` function is checkpointed by the
 * Workflow SDK, so the program is resumable across pauses and redeploys.
 *
 * Slice 1 uses lightweight placeholder perspectives to establish the pattern
 * and prove the withWorkflow wiring. Binding each step to a real eve subagent
 * (researcher / critic / memory-keeper) is the multi-agent-pattern slice.
 *
 * Start it from an API route or a tool with `start(parallelCouncil, [question])`
 * from `workflow/api`.
 */

async function consider(perspective: string, question: string): Promise<string> {
  "use step";
  return `[${perspective}] ${question}`;
}

export async function parallelCouncil(question: string): Promise<string> {
  "use workflow";

  const perspectives = ["researcher", "critic", "strategist"];
  const opinions = await Promise.all(
    perspectives.map((perspective) => consider(perspective, question)),
  );
  return `Council on "${question}":\n${opinions.join("\n")}`;
}
