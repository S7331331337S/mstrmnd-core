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

export async function writeBoardAudit(event: BoardAuditEvent): Promise<void> {
  const dest = filePath();
  await mkdir(path.dirname(dest), { recursive: true });
  await appendFile(dest, `${JSON.stringify(event)}\n`);
}
