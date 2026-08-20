import { notFound } from "next/navigation";
import Link from "next/link";
import { eventHash } from "@mstrmnd/genesis";
import { genesisService } from "@/lib/genesis-service";
import { VerifyPanel } from "./verify-panel";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ agentId: string; sequence: string }>;
}) {
  const { agentId: raw, sequence: seqRaw } = await params;
  const agentId = decodeURIComponent(raw);
  const sequence = Number(seqRaw);
  const event = await genesisService().getEvent(agentId, sequence);
  if (!event) notFound();
  const hash = eventHash(event);
  const batch = await genesisService().latestBatch(agentId);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">Chronicle event</span>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          {event.eventType}
        </h1>
        <p className="label">sequence {event.sequence}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
        {[
          { label: "Timestamp", value: event.timestamp },
          { label: "Event hash", value: hash },
          { label: "Payload hash", value: event.payloadHash },
          { label: "Previous", value: event.previousEventHash ?? "null (genesis)" },
          { label: "Runtime", value: `${event.runtime.framework}${event.runtime.model ? ` · ${event.runtime.model}` : ""}` },
          { label: "Session", value: event.sessionId ?? "—" },
          { label: "Run", value: event.runId ?? "—" },
          { label: "Human subject", value: event.actor.humanSubject ?? "—" },
          { label: "Agent signature", value: event.agentSignature.slice(0, 40) + "…" },
          { label: "Witness signature", value: event.witnessSignature.slice(0, 40) + "…" },
          {
            label: "Batch",
            value: batch
              ? `${batch.root.slice(0, 22)}… (${batch.fromSequence}–${batch.toSequence})`
              : "not anchored",
          },
        ].map((row) => (
          <div key={row.label} className="bg-surface px-4 py-3 flex flex-col gap-1">
            <span className="label">{row.label}</span>
            <span className="text-sm text-foreground break-all">{row.value}</span>
          </div>
        ))}
      </section>

      <p className="text-xs text-muted">
        Payload contents are redacted before hashing. The ledger stores the
        hash, not secrets or hidden chain-of-thought.
      </p>

      <VerifyPanel agentId={agentId} sequence={sequence} />

      <Link
        href={`/chronicle/id/${encodeURIComponent(agentId)}`}
        className="label hover:text-foreground"
      >
        ← Timeline
      </Link>
    </div>
  );
}
