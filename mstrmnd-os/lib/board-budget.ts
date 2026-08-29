import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Ledger = Record<string, number>;

function dayKey(workspaceId: string, now = new Date()): string {
  return `${workspaceId}:${now.toISOString().slice(0, 10)}`;
}

function filePath(): string {
  const root = process.env.MSTRMND_HOME ?? path.join(process.cwd(), ".mstrmnd");
  return path.join(root, "board-budget.json");
}

async function load(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(filePath(), "utf8")) as Ledger;
  } catch {
    return {};
  }
}

async function save(ledger: Ledger): Promise<void> {
  const dest = filePath();
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, `${JSON.stringify(ledger, null, 2)}\n`);
}

export async function usedToday(workspaceId: string): Promise<number> {
  const ledger = await load();
  return ledger[dayKey(workspaceId)] ?? 0;
}

export async function recordUse(workspaceId: string): Promise<number> {
  const ledger = await load();
  const key = dayKey(workspaceId);
  const next = (ledger[key] ?? 0) + 1;
  ledger[key] = next;
  await save(ledger);
  return next;
}
