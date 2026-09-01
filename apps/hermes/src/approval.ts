import path from "node:path";
import { randomUUID } from "node:crypto";
import type { WorkspaceManager } from "@mstrmnd/intelligence-core";

/**
 * Human-approval gate for agent-proposed file writes.
 *
 * AGENTS.md makes the approval gate a hard stop: the autonomous flow is
 * draft → user approves → publish, and nothing auto-publishes. Hermes plans
 * and drafts on its own, but the step that persists model-authored content
 * into the operator's vault always passes through here first.
 */

export interface PendingWrite {
  /** Absolute path the agent wants to publish to. */
  targetPath: string;
  /** Absolute path of the staged draft holding the proposed content. */
  draftPath: string;
  content: string;
}

export interface ApprovalDecision {
  approved: boolean;
  /** Why approval was withheld. Surfaced in the step result. */
  reason?: string;
}

export type Approver = (pending: PendingWrite) => Promise<ApprovalDecision>;

/** Relative location, inside the workspace, where drafts are staged. */
export const DRAFT_DIR = path.join(".mstrmnd", "drafts");

/**
 * Write the proposed content to a draft file inside the workspace.
 *
 * The draft goes through the same {@link WorkspaceManager} policy as any other
 * write, so a draft can never land outside the approved workspace either.
 */
export async function stageDraft(
  workspace: WorkspaceManager,
  targetPath: string,
  content: string
): Promise<{ draftPath: string; error?: string }> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.basename(targetPath) || `draft-${randomUUID()}`;
  const draftRelative = path.join(DRAFT_DIR, `${stamp}-${base}`);

  const result = await workspace.write(draftRelative, content);
  if (!result.written) {
    return { draftPath: result.path, error: result.policyViolation };
  }
  return { draftPath: result.path };
}

/**
 * Approver that refuses everything.
 *
 * This is the default for non-interactive runs (CI, cron, `HERMES_GOAL` in a
 * pipeline). Drafts are still produced, so the operator can review and publish
 * them later, but an unattended run can never write to the vault itself.
 */
export const denyApprover: Approver = async () => ({
  approved: false,
  reason: "no interactive operator attached to approve the write",
});

/**
 * Approver that prompts the operator on the terminal.
 *
 * Anything other than an explicit `y` / `yes` is a refusal, including EOF.
 */
export function createInteractiveApprover(): Approver {
  return async (pending) => {
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      console.log(`\n  Draft staged at: ${pending.draftPath}`);
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

/** Whether a human is actually attached to this process's terminal. */
export function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Pick the approver for this run: prompt when a human is attached to the
 * terminal, otherwise refuse. There is deliberately no environment variable
 * that turns the gate off.
 */
export function createApprover(): Approver {
  return isInteractiveSession() ? createInteractiveApprover() : denyApprover;
}

/**
 * Draft the proposed write, ask for approval, and publish only if it is given.
 *
 * Returns the human-readable outcome for the plan step.
 */
export async function publishWithApproval(
  workspace: WorkspaceManager,
  approve: Approver,
  targetPath: string,
  content: string
): Promise<string> {
  const absoluteTarget = workspace.resolvePath(targetPath);

  // Reject out-of-policy targets before staging anything or bothering the
  // operator with a prompt they should never be shown.
  if (!workspace.isAllowed(absoluteTarget)) {
    return `Write blocked by policy: ${absoluteTarget} is outside the approved workspace`;
  }

  const draft = await stageDraft(workspace, absoluteTarget, content);
  if (draft.error) {
    return `Draft blocked by policy: ${draft.error}`;
  }

  const decision = await approve({
    targetPath: absoluteTarget,
    draftPath: draft.draftPath,
    content,
  });

  if (!decision.approved) {
    return `Draft staged, awaiting approval — ${draft.draftPath} (not published: ${decision.reason ?? "approval withheld"})`;
  }

  const result = await workspace.write(absoluteTarget, content);
  return result.written
    ? `Published (approved): ${result.path}`
    : `Write blocked by policy: ${result.policyViolation}`;
}
