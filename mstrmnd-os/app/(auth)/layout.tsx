import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl w-full px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent pulse" />
            <span className="mono text-sm tracking-[0.35em] text-foreground">
              MSTRMND
            </span>
            <span className="label hidden sm:inline">/ OS</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
