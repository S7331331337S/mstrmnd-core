"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UserMenu({ email, name }: { email: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = name || email;

  return (
    <div className="flex items-center gap-3">
      <span className="label hidden sm:inline" title={email}>
        {label}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetch("/api/auth/signout", { method: "POST" });
          router.replace("/sign-in");
          router.refresh();
        }}
        className="label border border-line-strong px-2.5 py-1 hover:text-foreground disabled:opacity-40"
      >
        {busy ? "…" : "Sign out"}
      </button>
    </div>
  );
}
