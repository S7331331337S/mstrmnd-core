import Link from "next/link";
import { notFound } from "next/navigation";
import { genesisService } from "@/lib/genesis-service";

export const dynamic = "force-dynamic";

export default async function GenesisProfilePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId: raw } = await params;
  const agentId = decodeURIComponent(raw);
  const record = await genesisService().getAgent(agentId);
  if (!record) notFound();
  const m = record.signed.manifest;
  const keystore = process.env.MSTRMND_KEYSTORE ?? "local";
  const anchor = process.env.MSTRMND_ANCHOR ?? "log";

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">Genesis ID</span>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          {m.name}
        </h1>
        <p className="mono text-xs text-muted break-all">{record.agentId}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
        {[
          { label: "did:key", value: m.didKey },
          { label: "Controller", value: `${m.controller.type}:${m.controller.id}` },
          { label: "Public key", value: m.publicKey.multibase },
          { label: "Created", value: m.createdAt },
          { label: "Model policy", value: m.runtimePolicy.modelPolicy },
          { label: "Approval policy", value: m.runtimePolicy.approvalPolicy },
          { label: "Keystore", value: keystore },
          { label: "Anchor", value: anchor },
          {
            label: "Parent",
            value: m.lineage.parentAgentId ?? "root (generation 0)",
          },
          { label: "Manifest hash", value: record.signed.manifestHash },
        ].map((row) => (
          <div key={row.label} className="bg-surface px-4 py-3 flex flex-col gap-1">
            <span className="label">{row.label}</span>
            <span className="text-sm text-foreground break-all">{row.value}</span>
          </div>
        ))}
      </section>

      <section className="border border-line bg-surface px-4 py-3 flex flex-col gap-2">
        <span className="label">Identity</span>
        <p className="text-sm text-foreground">{m.identity.purpose}</p>
        <p className="text-xs text-muted">
          Values: {m.identity.values.join(" · ") || "—"}
        </p>
        <p className="text-xs text-muted">
          Boundaries: {m.identity.boundaries.join(" · ") || "—"}
        </p>
      </section>

      <section className="border border-line bg-surface px-4 py-3 flex flex-col gap-2">
        <span className="label">Artifact hashes</span>
        <ul className="mono text-[11px] text-muted space-y-1 break-all">
          <li>instructions {m.artifacts.instructionsHash}</li>
          <li>skills {m.artifacts.skillsRoot}</li>
          <li>tools {m.artifacts.toolsRoot}</li>
          <li>policy {m.artifacts.policyHash}</li>
        </ul>
      </section>

      <Link
        href={`/chronicle/id/${encodeURIComponent(record.agentId)}`}
        className="label hover:text-foreground"
      >
        Open Chronicle timeline →
      </Link>
    </div>
  );
}
