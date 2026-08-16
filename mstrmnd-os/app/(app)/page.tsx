import { AllianceCommand } from "@/app/_components/alliance-command";
import { ROSTER } from "@/app/_components/roster";
import { activeProviderLabel } from "@/agent/lib/model";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const provider = activeProviderLabel();
  const session = await getSession();
  const firstName = (session?.name || "operator").split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <span className="label">Multi-Agent Mastermind OS</span>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground max-w-2xl">
          A private alliance of specialized minds — continuous, coordinated,
          built to execute.
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          Welcome back, {firstName}. Maestro coordinates specialists over your
          workspace&rsquo;s shared Third-Mind. Models are interchangeable; the
          alliance persists.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pt-1">
          <span className="label">
            Runtime · eve · model provider:{" "}
            <span className="text-foreground">{provider}</span>
          </span>
          <span className="label">Durability · Vercel Workflows</span>
          <span className="label">Execution · Vercel Sandbox</span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <AllianceCommand />

        <aside className="border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 h-10">
            <span className="label">Alliance roster</span>
            <span className="label">{ROSTER.length} minds</span>
          </div>
          <ul className="divide-y divide-line">
            {ROSTER.map((member) => (
              <li key={member.id} className="px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{member.title}</span>
                  <span className="label">
                    {member.role === "root" ? "root" : "subagent"}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {member.mandate}
                </p>
                {member.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {member.tools.map((tool) => (
                      <span
                        key={tool}
                        className="mono text-[10px] text-faint border border-line px-1.5 py-0.5"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
