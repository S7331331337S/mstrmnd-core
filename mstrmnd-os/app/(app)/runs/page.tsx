import { ROSTER } from "@/app/_components/roster";
import { activeProviderLabel } from "@/agent/lib/model";

export const dynamic = "force-dynamic";

const CAPABILITIES = [
  { label: "Agent runtime", value: "eve (filesystem-first, durable sessions)" },
  { label: "Model access", value: "AI Gateway / AI SDK (provider-agnostic)" },
  { label: "Durability", value: "Vercel Workflows (checkpointed steps)" },
  { label: "Execution", value: "Vercel Sandbox (approval-gated execute_code)" },
  { label: "Auth", value: "Session-gated app + agent (per-workspace scope)" },
  { label: "Memory", value: "Third-Mind shared observation layer" },
];

export default function RunsPage() {
  const provider = activeProviderLabel();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">Agent status</span>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Alliance
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          The composed alliance and the stack it runs on. Live per-session runs,
          turns, tools, tokens, and cost are captured by eve traces and Vercel
          observability.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
        {CAPABILITIES.map((c) => (
          <div key={c.label} className="bg-surface px-4 py-3 flex flex-col gap-1">
            <span className="label">{c.label}</span>
            <span className="text-sm text-foreground">{c.value}</span>
          </div>
        ))}
      </section>

      <section className="border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 h-10">
          <span className="label">Minds</span>
          <span className="label">
            provider: <span className="text-foreground">{provider}</span>
          </span>
        </div>
        <ul className="divide-y divide-line">
          {ROSTER.map((member) => (
            <li
              key={member.id}
              className="px-4 py-3 flex items-start justify-between gap-4"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="text-sm text-foreground">{member.title}</span>
                  <span className="label">
                    {member.role === "root" ? "root" : "subagent"}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed max-w-xl">
                  {member.mandate}
                </p>
              </div>
              <span className="label shrink-0">ready</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
