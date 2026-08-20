import type { AnchorAdapter, MerkleBatch } from "./types";
import { BATCH_SCHEMA } from "./types";
import { merkleRoot } from "./merkle";
import type { GenesisEvent } from "./types";
import { eventHash } from "./event-hash";

/**
 * Default transparency-log adapter: persist the Merkle root locally.
 * `evm` and `rekor` adapters implement the same interface; this PR does not
 * talk to an RPC or Rekor instance.
 */
export class LogAnchor implements AnchorAdapter {
  readonly kind = "log" as const;

  async publish(root: string, meta: Record<string, unknown>): Promise<{ ref: string }> {
    const ref = `log:${root}:${String(meta.agentId ?? "unknown")}`;
    return { ref };
  }
}

export function selectAnchor(kind?: string): AnchorAdapter {
  const k = (kind ?? process.env.MSTRMND_ANCHOR ?? "log").toLowerCase();
  if (k === "log") return new LogAnchor();
  // Typed seams only — live adapters ship with their own modules.
  throw new Error(
    `anchor adapter "${k}" is not implemented in this slice (use MSTRMND_ANCHOR=log)`,
  );
}

export async function batchEvents(
  agentId: string,
  events: GenesisEvent[],
  anchor: AnchorAdapter,
): Promise<MerkleBatch> {
  if (events.length === 0) throw new Error("cannot batch zero events");
  const hashes = events.map(eventHash);
  const root = merkleRoot(hashes);
  const fromSequence = events[0].sequence;
  const toSequence = events[events.length - 1].sequence;
  const { ref } = await anchor.publish(root, {
    agentId,
    fromSequence,
    toSequence,
  });
  return {
    schema: BATCH_SCHEMA,
    agentId,
    fromSequence,
    toSequence,
    root,
    eventHashes: hashes,
    anchoredAt: new Date().toISOString(),
    anchor: { kind: anchor.kind, ref },
  };
}
