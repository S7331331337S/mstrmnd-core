import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AgentRecord, AgentRegistry, GenesisEvent, LedgerStore } from "./types";

function fileSafe(agentId: string): string {
  return agentId.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/**
 * Append-only JSONL ledger. Used by Hermes/CI and as the file-backed fallback
 * in mstrmnd-os when DATABASE_URL is unset.
 */
export class JsonlLedger implements LedgerStore {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private pathFor(agentId: string): string {
    return join(this.dir, `${fileSafe(agentId)}.jsonl`);
  }

  private load(agentId: string): GenesisEvent[] {
    const path = this.pathFor(agentId);
    if (!existsSync(path)) return [];
    const text = readFileSync(path, "utf8");
    const out: GenesisEvent[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      out.push(JSON.parse(trimmed) as GenesisEvent);
    }
    return out;
  }

  async append(event: GenesisEvent): Promise<void> {
    const existing = this.load(event.agentId);
    if (existing.some((e) => e.sequence === event.sequence)) {
      throw new Error(
        `append-only ledger refuses rewrite of ${event.agentId}#${event.sequence}`,
      );
    }
    const tip = existing[existing.length - 1];
    if (tip && event.sequence !== tip.sequence + 1) {
      throw new Error(
        `sequence gap: tip=${tip.sequence} incoming=${event.sequence}`,
      );
    }
    if (!tip && event.sequence !== 1) {
      throw new Error(`first event must be sequence 1, got ${event.sequence}`);
    }
    const path = this.pathFor(event.agentId);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(event) + "\n", "utf8");
  }

  async getTip(agentId: string): Promise<GenesisEvent | null> {
    const rows = this.load(agentId);
    return rows[rows.length - 1] ?? null;
  }

  async list(
    agentId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<GenesisEvent[]> {
    const rows = this.load(agentId);
    const offset = opts.offset ?? 0;
    const sliced = rows.slice(offset);
    return opts.limit != null ? sliced.slice(0, opts.limit) : sliced;
  }

  async get(agentId: string, sequence: number): Promise<GenesisEvent | null> {
    return this.load(agentId).find((e) => e.sequence === sequence) ?? null;
  }
}

/** File-backed agent registry (manifests, not keys). */
export class JsonAgentRegistry implements AgentRegistry {
  constructor(private readonly path: string) {}

  private load(): AgentRecord[] {
    if (!existsSync(this.path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8"));
      return Array.isArray(parsed) ? (parsed as AgentRecord[]) : [];
    } catch {
      return [];
    }
  }

  private save(rows: AgentRecord[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(rows, null, 2), "utf8");
  }

  async put(record: AgentRecord): Promise<void> {
    const rows = this.load();
    const idx = rows.findIndex((r) => r.agentId === record.agentId);
    if (idx >= 0) rows[idx] = record;
    else rows.push(record);
    this.save(rows);
  }

  async get(agentId: string): Promise<AgentRecord | null> {
    return this.load().find((r) => r.agentId === agentId) ?? null;
  }

  async getByName(workspaceId: string, name: string): Promise<AgentRecord | null> {
    const needle = name.toLowerCase();
    return (
      this.load().find(
        (r) =>
          (r.workspaceId ?? "") === workspaceId &&
          r.name.toLowerCase() === needle,
      ) ?? null
    );
  }

  async list(workspaceId?: string): Promise<AgentRecord[]> {
    const rows = this.load();
    return workspaceId
      ? rows.filter((r) => (r.workspaceId ?? "") === workspaceId)
      : rows;
  }
}
