import Link from "next/link";
import { getSession } from "@/lib/auth";
import { genesisService } from "@/lib/genesis-service";

export const dynamic = "force-dynamic";

export default async function ChronicleIndexPage() {
  const session = await getSession();
  const agents = session
    ? await genesisService().listAgents(session.workspaceId)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">Chronicle</span>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Observable history
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          Hash-chained, dual-signed events. Tamper-evident once accepted — not
          a claim that the database itself is immutable.
        </p>
      </section>

      <section className="border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 h-10">
          <span className="label">Agents</span>
          <span className="label">{agents.length}</span>
        </div>
        {agents.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            Issue an identity in Foundry to start a chronicle.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {agents.map((a) => (
              <li key={a.agentId} className="px-4 py-3">
                <Link
                  href={`/chronicle/id/${encodeURIComponent(a.agentId)}`}
                  className="text-sm text-foreground hover:underline"
                >
                  {a.name}
                </Link>
                <p className="mono text-[11px] text-muted break-all">
                  {a.agentId}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
