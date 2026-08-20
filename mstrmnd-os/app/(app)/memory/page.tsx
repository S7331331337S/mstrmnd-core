import { thirdMind } from "@/agent/lib/third-mind";
import { getSession } from "@/lib/auth";
import { AddObservation } from "./add-observation";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function MemoryPage() {
  const session = await getSession();
  const observations = session
    ? await thirdMind().list(session.workspaceId, 50)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">Shared observation layer</span>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Third-Mind
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          Your workspace&rsquo;s collective memory. Every mind reads and writes
          here through tools; observations survive across sessions and agents and
          never cross workspace boundaries.
        </p>
      </section>

      <AddObservation />

      <section className="border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 h-10">
          <span className="label">Observations</span>
          <span className="label">{observations.length} recorded</span>
        </div>
        {observations.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            The Third-Mind is empty. Record the first observation above, or let
            Maestro write one during a turn.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {observations.map((o) => (
              <li key={o.id} className="px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="mono text-xs text-foreground">{o.key}</span>
                  <span className="label shrink-0">
                    {o.agent} · {timeAgo(o.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {o.content}
                </p>
                {o.supersedes ? (
                  <span className="label">
                    supersedes {o.supersedes.slice(0, 8)}
                    {o.reason ? ` · ${o.reason}` : ""}
                  </span>
                ) : null}
                {o.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {o.tags.map((t) => (
                      <span
                        key={t}
                        className="mono text-[10px] text-faint border border-line px-1.5 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
