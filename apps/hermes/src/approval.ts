import {
  denyApprover,
  isInteractiveSession,
  type WriteApprover,
} from "@mstrmnd/intelligence-core";

/**
 * Approver that prompts the operator on the terminal.
 * Anything other than an explicit `y` / `yes` is a refusal, including EOF.
 */
export function createInteractiveApprover(): WriteApprover {
  return async (pending) => {
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      console.log(`\n  Draft staged at: ${pending.draftPath} (${pending.draftId})`);
      console.log(`  Proposed publish target: ${pending.targetPath}`);
      const answer = await rl.question("  Approve this write? [y/N] ");
      const approved = /^y(es)?$/i.test(answer.trim());
      return approved
        ? { approved: true }
        : { approved: false, reason: "operator declined" };
    } catch {
      return { approved: false, reason: "approval prompt unavailable" };
    } finally {
      rl.close();
    }
  };
}

/**
 * Prompt when a human is attached to the terminal; otherwise refuse.
 * There is deliberately no environment variable that turns the gate off.
 */
export function createApprover(): WriteApprover {
  return isInteractiveSession() ? createInteractiveApprover() : denyApprover;
}

export { denyApprover, isInteractiveSession };
export type { WriteApprover };
