import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSTRMND OS — Alliance",
  description:
    "Multi-Agent Mastermind OS — a private alliance of specialized minds, continuous, coordinated, and built to execute.",
};

const NAV = [
  { href: "/", label: "Alliance" },
  { href: "/memory", label: "Third-Mind" },
  { href: "/runs", label: "Agents" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
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
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto max-w-6xl w-full px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl w-full px-6 h-12 flex items-center justify-between">
            <span className="label">Intelligence layer · not the model</span>
            <span className="label">Human approval is a hard stop</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
