import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ArcWatch · Arc Onchain Observatory",
  description:
    "Evidence-first analytics for Circle's Arc blockchain: chain state, native USDC movements (EIP-7708), and tracked stablecoin activity.",
};

const NAV = [
  { href: "/", label: "Chain Pulse" },
  { href: "/usdc", label: "USDC Flows" },
  { href: "/tokens", label: "Tokens" },
  { href: "/health", label: "Source Health" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b" style={{ borderColor: "var(--border)" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold">
              Arc<span style={{ color: "var(--accent)" }}>watch</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="text-[var(--muted)] hover:text-[var(--text)]">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Providers>{children}</Providers>
        </main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-[var(--muted)]">
          Independent public-source research. Not affiliated with or endorsed by Circle. Data is
          observed from public Arc RPC with source and freshness labels; missing data stays
          unavailable.
        </footer>
      </body>
    </html>
  );
}
