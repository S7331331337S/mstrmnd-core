"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FoundryForm() {
  const router = useRouter();
  const [name, setName] = useState("Maestro");
  const [purpose, setPurpose] = useState("Coordinate MSTRMND operations");
  const [values, setValues] = useState("accuracy, initiative, traceability");
  const [boundaries, setBoundaries] = useState(
    "no unapproved financial transactions",
  );
  const [controllerId, setControllerId] = useState("mstrmnd.ai");
  const [modelPolicy, setModelPolicy] = useState("gateway/model-agnostic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="border border-line bg-surface p-4 flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/genesis/create", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name,
              purpose,
              values,
              boundaries,
              controllerType: "organization",
              controllerId,
              modelPolicy,
              approvalPolicy: "risk-tiered",
              bindSubagents: true,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "issue failed");
          const first = data.agents?.[0]?.agentId as string | undefined;
          router.push(first ? `/genesis/id/${encodeURIComponent(first)}` : "/genesis");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "issue failed");
          setBusy(false);
        }
      }}
    >
      <span className="label">Issue a Genesis identity</span>
      <label className="flex flex-col gap-1">
        <span className="label">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Purpose</span>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          rows={2}
          className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong resize-y"
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="label">Values</span>
          <input
            value={values}
            onChange={(e) => setValues(e.target.value)}
            className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Boundaries</span>
          <input
            value={boundaries}
            onChange={(e) => setBoundaries(e.target.value)}
            className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong mono"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="label">Controller</span>
          <input
            value={controllerId}
            onChange={(e) => setControllerId(e.target.value)}
            className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Model policy</span>
          <input
            value={modelPolicy}
            onChange={(e) => setModelPolicy(e.target.value)}
            className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong mono"
          />
        </label>
      </div>
      {error && <span className="label text-foreground">{error}</span>}
      <div className="flex items-center justify-between pt-1">
        <span className="label">
          Ed25519 key stays in the keystore — never in agent/
        </span>
        <button
          type="submit"
          disabled={busy}
          className="label border border-line-strong px-3 py-1.5 text-foreground hover:bg-surface-2 disabled:opacity-40"
        >
          {busy ? "Issuing…" : "Issue Genesis ID"}
        </button>
      </div>
    </form>
  );
}
