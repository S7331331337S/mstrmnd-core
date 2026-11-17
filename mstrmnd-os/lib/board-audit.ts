import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type BoardAuditEvent = {
  at: string;
  workspaceId: string;
  userId: string;
  action: "complete";
  allowed: boolean;
  reason?: string;
  hint?: string;
  provider: string;
  promptChars: number;
};

function filePath(): string {
  const root = process.env.MSTRMND_HOME ?? path.join(process.cwd(), ".mstrmnd");
  return path.join(root, "board-audit.jsonl");
}

/**
 * Best-effort audit. On a read-only filesystem (Vercel functions: /var/task)
 * the file append fails; that must not turn an auth denial into a 500, so the
 * event goes to the function log instead.
 */
export async function writeBoardAudit(event: BoardAuditEvent): Promise<void> {
  const line = JSON.stringify(event);
  try {
    const dest = filePath();
    await mkdir(path.dirname(dest), { recursive: true });
    await appendFile(dest, `${line}\n`);
  } catch {
    console.info(`[board-audit] ${line}`);
  }
}
