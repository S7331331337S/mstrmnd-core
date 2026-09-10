import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { UserMenu } from "@/app/_components/user-menu";
import { PixelWordmark } from "@/app/_components/pixel-wordmark";

const NAV = [
  { href: "/", label: "Alliance" },
  { href: "/memory", label: "Third-Mind" },
  { href: "/runs", label: "Agents" },
  { href: "/field", label: "Field" },
  { href: "/lab", label: "Lab" },
  { href: "/cockpit", label: "Cockpit" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-col items-start gap-3 px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0">
          <Link href="/" className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent pulse" />
            <PixelWordmark />
            <span className="label hidden sm:inline">/ OS</span>
          </Link>
          <nav className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="label-grid hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <UserMenu email={session.email} name={session.name} />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
          <span className="label">Intelligence layer · not the model</span>
          <span className="label">Human approval is a hard stop</span>
        </div>
      </footer>
    </>
  );
}
