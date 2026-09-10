import type { WorkspaceService, WorkspaceDraft } from "./workspace-service";
import { WorkspacePathError } from "./workspace-service";

/**
 * Human-approval gate for agent-proposed workspace writes.
 *
 * Autonomous flow is draft → user approves → publish. Nothing auto-publishes.
 * There is deliberately no environment variable that turns this gate off.
 */

export interface PendingWrite {
  mountId: string;
  targetPath: string;
  draftPath: string;
  draftId: string;
  content: string;
}

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
}

export type WriteApprover = (pending: PendingWrite) => Promise<ApprovalDecision>;

/** Default for non-interactive runs (CI, pipelines, MCP without a TTY). */
export const denyApprover: WriteApprover = async () => ({
  approved: false,
  reason: "no interactive operator attached to approve the write",
});

export function isInteractiveSession(
  stdin: { isTTY?: boolean } = process.stdin,
  stdout: { isTTY?: boolean } = process.stdout
): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

export interface PublishOutcome {
  published: boolean;
  draft?: WorkspaceDraft;
  message: string;
}

/**
 * Stage a draft, then publish only if the approver returns approved.
 * Out-of-mount targets are refused before staging. Dry-run writes nothing.
 */
export async function stageAndMaybePublish(
  workspace: WorkspaceService,
  approver: WriteApprover,
  mountId: string,
  targetPath: string,
  content: string,
  opts: { dryRun?: boolean } = {}
): Promise<PublishOutcome> {
  if (opts.dryRun) {
    return {
      published: false,
      message: `dry-run: would draft ${targetPath} (vault not written)`,
    };
  }

  try {
    workspace.resolveSafe(mountId, targetPath);
  } catch (err) {
    const reason = err instanceof WorkspacePathError ? err.message : String(err);
    return {
      published: false,
      message: `Write blocked by policy: ${reason}`,
    };
  }

  let draft: WorkspaceDraft;
  try {
    draft = await workspace.stageDraft(mountId, targetPath, content);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      published: false,
      message: `Draft blocked by policy: ${reason}`,
    };
  }

  const decision = await approver({
    mountId,
    targetPath,
    draftPath: draft.draftPath,
    draftId: draft.id,
    content,
  });

  if (!decision.approved) {
    return {
      published: false,
      draft,
      message: `Draft staged, awaiting approval — ${draft.id} (${draft.draftPath}; not published: ${decision.reason ?? "approval withheld"})`,
    };
  }

  const result = await workspace.publishDraft(draft.id);
  return {
    published: true,
    draft,
    message: `Published (approved): ${result.path}`,
  };
}
