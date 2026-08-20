"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AnchorButton({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {error && <span className="label text-foreground">{error}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/genesis/anchor", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ agentId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "anchor failed");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "anchor failed");
          } finally {
            setBusy(false);
          }
        }}
        className="label border border-line-strong px-3 py-1.5 hover:text-foreground disabled:opacity-40"
      >
        {busy ? "Anchoring…" : "Anchor Merkle root"}
      </button>
    </div>
  );
}
