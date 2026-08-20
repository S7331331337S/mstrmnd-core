import Link from "next/link";
import { notFound } from "next/navigation";
import { genesisService } from "@/lib/genesis-service";
import { AnchorButton } from "./anchor-button";

export const dynamic = "force-dynamic";

export default async function ChronicleTimelinePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId: raw } = await params;
  const agentId = decodeURIComponent(raw);
  const record = await genesisService().getAgent(agentId);
  if (!record) notFound();
  const events = await genesisService().listEvents(agentId, 200);
  const batch = await genesisService().latestBatch(agentId);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">Chronicle</span>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          {record.name}
        </h1>
        <p className="mono text-xs text-muted break-all">{agentId}</p>
      </section>

      <div className="flex items-center justify-between">
        <span className="label">
          {events.length} events
          {batch
            ? ` · anchored ${batch.fromSequence}–${batch.toSequence}`
            : " · not yet anchored"}
        </span>
        <AnchorButton agentId={agentId} />
      </div>

      <section className="border border-line bg-surface">
        <div className="border-b border-line px-4 h-10 flex items-center">
          <span className="label">Timeline</span>
        </div>
        {events.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No events yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...events].reverse().map((e) => (
              <li key={`${e.agentId}:${e.sequence}`} className="px-4 py-3">
                <Link
                  href={`/chronicle/id/${encodeURIComponent(agentId)}/${e.sequence}`}
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground">{e.eventType}</span>
                    <span className="label">#{e.sequence}</span>
                  </div>
                  <span className="mono text-[11px] text-muted">
                    {e.timestamp} · {e.payloadHash.slice(0, 22)}…
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
