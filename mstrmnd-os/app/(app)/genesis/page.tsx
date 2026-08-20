import Link from "next/link";
import { getSession } from "@/lib/auth";
import { genesisService } from "@/lib/genesis-service";

export const dynamic = "force-dynamic";

export default async function GenesisListPage() {
  const session = await getSession();
  const agents = session
    ? await genesisService().listAgents(session.workspaceId)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">Genesis ID</span>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Permanent agent identities
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          Public keys, controllers, artifact hashes, and lineage. Private keys
          never leave the keystore adapter.
        </p>
      </section>

      <section className="border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 h-10">
          <span className="label">Agents</span>
          <Link href="/foundry" className="label hover:text-foreground">
            Issue in Foundry
          </Link>
        </div>
        {agents.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            No genesis identities in this workspace yet. Issue Maestro from
            Foundry.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {agents.map((a) => (
              <li key={a.agentId} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-4">
                  <Link
                    href={`/genesis/id/${encodeURIComponent(a.agentId)}`}
                    className="text-sm text-foreground hover:underline"
                  >
                    {a.name}
                  </Link>
                  <span className="label">
                    gen {a.signed.manifest.lineage.generation}
                  </span>
                </div>
                <span className="mono text-[11px] text-muted break-all">
                  {a.agentId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
