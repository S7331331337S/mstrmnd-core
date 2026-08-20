import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UserMenu } from "@/app/_components/user-menu";

const NAV = [
  { href: "/", label: "Alliance" },
  { href: "/memory", label: "Third-Mind" },
  { href: "/foundry", label: "Foundry" },
  { href: "/genesis", label: "Genesis" },
  { href: "/chronicle", label: "Chronicle" },
  { href: "/runs", label: "Agents" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl w-full px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent pulse" />
            <span className="mono text-sm tracking-[0.35em] text-foreground">
              MSTRMND
            </span>
            <span className="label hidden sm:inline">/ OS</span>
          </Link>
          <nav className="flex items-center gap-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="label hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <UserMenu email={session.email} name={session.name} />
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-6 py-8">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl w-full px-6 h-12 flex items-center justify-between">
          <span className="label">Intelligence layer · not the model</span>
          <span className="label">Human approval is a hard stop</span>
        </div>
      </footer>
    </>
  );
}
