"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({
  mode,
  next,
}: {
  mode: "sign-in" | "sign-up";
  next: string;
}) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="label">{isSignUp ? "Create account" : "Sign in"}</span>
        <h1 className="text-xl font-medium tracking-tight text-foreground">
          {isSignUp ? "Assemble your alliance" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted">
          {isSignUp
            ? "Your private alliance of specialized minds."
            : "Direct your alliance."}
        </p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/auth/${isSignUp ? "signup" : "signin"}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(
                isSignUp ? { name, email, password } : { email, password },
              ),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
            router.replace(next || "/");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
            setBusy(false);
          }
        }}
      >
        {isSignUp && (
          <label className="flex flex-col gap-1">
            <span className="label">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Ada Lovelace"
              className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
            placeholder={isSignUp ? "At least 8 characters" : "••••••••"}
            className="bg-transparent border border-line px-3 py-2 text-sm outline-none focus:border-line-strong"
          />
        </label>

        {error && <span className="label text-foreground">{error}</span>}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 border border-line-strong bg-surface-2 px-3 py-2 text-sm text-foreground hover:bg-surface disabled:opacity-40"
        >
          {busy
            ? isSignUp
              ? "Creating…"
              : "Signing in…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="text-sm text-muted">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-foreground hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/sign-up" className="text-foreground hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
