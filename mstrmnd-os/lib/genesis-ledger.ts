import type {
  AgentRecord,
  AgentRegistry,
  GenesisEvent,
  LedgerStore,
  MerkleBatch,
} from "@mstrmnd/genesis";
import { eventHash } from "@mstrmnd/genesis";
import { ensureSchema, getPool } from "./db";
import { randomUUID } from "node:crypto";

interface EventRow {
  event: GenesisEvent;
}

export class PostgresLedger implements LedgerStore {
  async append(event: GenesisEvent): Promise<void> {
    await ensureSchema();
    try {
      await getPool().query(
        `insert into genesis_events (event_hash, agent_id, sequence, event)
         values ($1, $2, $3, $4::jsonb)`,
        [eventHash(event), event.agentId, event.sequence, JSON.stringify(event)],
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new Error(
          `append-only ledger refuses rewrite of ${event.agentId}#${event.sequence}`,
        );
      }
      throw err;
    }
  }

  async getTip(agentId: string): Promise<GenesisEvent | null> {
    await ensureSchema();
    const { rows } = await getPool().query<EventRow>(
      `select event from genesis_events
        where agent_id = $1
        order by sequence desc
        limit 1`,
      [agentId],
    );
    return rows[0]?.event ?? null;
  }

  async list(
    agentId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<GenesisEvent[]> {
    await ensureSchema();
    const { rows } = await getPool().query<EventRow>(
      `select event from genesis_events
        where agent_id = $1
        order by sequence asc
        offset $2
        limit $3`,
      [agentId, opts.offset ?? 0, opts.limit ?? 1000],
    );
    return rows.map((r) => r.event);
  }

  async get(agentId: string, sequence: number): Promise<GenesisEvent | null> {
    await ensureSchema();
    const { rows } = await getPool().query<EventRow>(
      `select event from genesis_events
        where agent_id = $1 and sequence = $2`,
      [agentId, sequence],
    );
    return rows[0]?.event ?? null;
  }
}

interface AgentRow {
  agent_id: string;
  workspace_id: string;
  name: string;
  key_handle: string;
  signed: AgentRecord["signed"];
  created_at: string | Date;
}

function rowToRecord(r: AgentRow): AgentRecord {
  return {
    agentId: r.agent_id,
    name: r.name,
    workspaceId: r.workspace_id,
    keyHandle: r.key_handle,
    signed: r.signed,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export class PostgresAgentRegistry implements AgentRegistry {
  async put(record: AgentRecord): Promise<void> {
    await ensureSchema();
    const m = record.signed.manifest;
    await getPool().query(
      `insert into genesis_agents
         (agent_id, workspace_id, name, key_handle, manifest, signed,
          did_key, public_key_multibase, parent_agent_id, created_at)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10)
       on conflict (agent_id) do update set
         signed = excluded.signed,
         manifest = excluded.manifest,
         key_handle = excluded.key_handle`,
      [
        record.agentId,
        record.workspaceId ?? "",
        record.name,
        record.keyHandle,
        JSON.stringify(m),
        JSON.stringify(record.signed),
        m.didKey,
        m.publicKey.multibase,
        m.lineage.parentAgentId,
        record.createdAt,
      ],
    );
  }

  async get(agentId: string): Promise<AgentRecord | null> {
    await ensureSchema();
    const { rows } = await getPool().query<AgentRow>(
      `select agent_id, workspace_id, name, key_handle, signed, created_at
         from genesis_agents where agent_id = $1`,
      [agentId],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async getByName(workspaceId: string, name: string): Promise<AgentRecord | null> {
    await ensureSchema();
    const { rows } = await getPool().query<AgentRow>(
      `select agent_id, workspace_id, name, key_handle, signed, created_at
         from genesis_agents
        where workspace_id = $1 and lower(name) = lower($2)
        limit 1`,
      [workspaceId, name],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async list(workspaceId?: string): Promise<AgentRecord[]> {
    await ensureSchema();
    const { rows } = workspaceId
      ? await getPool().query<AgentRow>(
          `select agent_id, workspace_id, name, key_handle, signed, created_at
             from genesis_agents where workspace_id = $1
             order by created_at asc`,
          [workspaceId],
        )
      : await getPool().query<AgentRow>(
          `select agent_id, workspace_id, name, key_handle, signed, created_at
             from genesis_agents order by created_at asc`,
        );
    return rows.map(rowToRecord);
  }
}

export async function insertBatch(batch: MerkleBatch): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `insert into genesis_batches
       (id, agent_id, from_sequence, to_sequence, root, event_hashes,
        anchor_kind, anchor_ref, anchored_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      randomUUID(),
      batch.agentId,
      batch.fromSequence,
      batch.toSequence,
      batch.root,
      batch.eventHashes,
      batch.anchor.kind,
      batch.anchor.ref ?? null,
      batch.anchoredAt,
    ],
  );
}

export async function latestBatch(
  agentId: string,
): Promise<MerkleBatch | null> {
  await ensureSchema();
  const { rows } = await getPool().query<{
    agent_id: string;
    from_sequence: number;
    to_sequence: number;
    root: string;
    event_hashes: string[];
    anchor_kind: string;
    anchor_ref: string | null;
    anchored_at: string | Date;
  }>(
    `select agent_id, from_sequence, to_sequence, root, event_hashes,
            anchor_kind, anchor_ref, anchored_at
       from genesis_batches
      where agent_id = $1
      order by anchored_at desc
      limit 1`,
    [agentId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    schema: "mstrmnd.batch/v1",
    agentId: r.agent_id,
    fromSequence: r.from_sequence,
    toSequence: r.to_sequence,
    root: r.root,
    eventHashes: r.event_hashes,
    anchoredAt: new Date(r.anchored_at).toISOString(),
    anchor: {
      kind: r.anchor_kind as MerkleBatch["anchor"]["kind"],
      ref: r.anchor_ref ?? undefined,
    },
  };
}
