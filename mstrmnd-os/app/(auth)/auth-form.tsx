"use client";

import Link from "next/link";
import { AsciiMark } from "@/app/_components/ascii-mark";
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
      <AsciiMark fit className="-mx-1" />
      <div className="flex flex-col gap-1">
        <span className="label-legible">{isSignUp ? "Create account" : "Sign in"}</span>
        <h1 className="display-pixel text-xl font-medium tracking-tight text-foreground">
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
            <span className="label-legible">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Ada Lovelace"
              className="bg-transparent border border-line px-3 py-2 text-sm placeholder:text-muted outline-none focus:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="label-legible">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="bg-transparent border border-line px-3 py-2 text-sm placeholder:text-muted outline-none focus:border-foreground focus-visible:ring-1 focus-visible:ring-foreground mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-legible">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            className="bg-transparent border border-line px-3 py-2 text-sm placeholder:text-muted outline-none focus:border-foreground focus-visible:ring-1 focus-visible:ring-foreground"
          />
        </label>

        {error && <span role="alert" className="label-legible !text-foreground">
            {error}
          </span>}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 display-pixel border border-foreground bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-foreground"
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
