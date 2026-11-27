import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/lib/env";
import "./globals.css";
export const metadata: Metadata = {
  title: "Link · Support center",
  description: "Two portals, one support workflow. A local Jev demo.",
};
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabled = env().jevEnabled;
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-symbol">l</span>link
            <span className="brand-separator" /> <small>support center</small>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/customer">Customer portal</Link>
            <Link href="/consultant">Consultant workspace</Link>
          </nav>
          <span className={`mode ${enabled ? "enabled" : ""}`}>
            <i />
            {enabled ? "Jev enabled" : "Manual mode"}
          </span>
        </header>
        <main>{children}</main>
        <footer>
          <span>Link / Support request demo</span>
          <span>One demo customer · No sign-in</span>
        </footer>
      </body>
    </html>
  );
}
