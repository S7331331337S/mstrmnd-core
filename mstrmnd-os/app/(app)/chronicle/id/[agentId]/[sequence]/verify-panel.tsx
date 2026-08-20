"use client";

import { useState } from "react";

export function VerifyPanel({
  agentId,
  sequence,
}: {
  agentId: string;
  sequence: number;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    checks: Record<string, boolean | undefined>;
    reasons: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="border border-line bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label">Verify this event</span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch("/api/genesis/verify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ agentId, sequence }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "verify failed");
              setResult(data);
            } catch (err) {
              setError(err instanceof Error ? err.message : "verify failed");
            } finally {
              setBusy(false);
            }
          }}
          className="label border border-line-strong px-3 py-1.5 hover:text-foreground disabled:opacity-40"
        >
          {busy ? "Verifying…" : "Verify signatures + chain"}
        </button>
      </div>
      {error && <span className="label text-foreground">{error}</span>}
      {result && (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground">
            {result.ok ? "Valid — signatures and chain hold." : "Invalid"}
          </span>
          <ul className="label space-y-1">
            {Object.entries(result.checks).map(([k, v]) => (
              <li key={k}>
                {k}: {v === undefined ? "n/a" : v ? "ok" : "fail"}
              </li>
            ))}
          </ul>
          {result.reasons.length > 0 && (
            <p className="text-xs text-muted">{result.reasons.join(" · ")}</p>
          )}
        </div>
      )}
    </section>
  );
}
