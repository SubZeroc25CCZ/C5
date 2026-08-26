import type { Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

// Every page is per-user and sits behind ClerkProvider, so nothing is
// meaningfully static — and prerendering at build time would make the build
// require runtime secrets (the missing-publishableKey failure on Vercel).
// Render everything on demand; env vars are needed only at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SubZero — find and cancel forgotten subscriptions",
  description:
    "SubZero reads your email receipts (with your consent, read-only) and shows every recurring subscription, what it really costs per month, and how to escape it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1.25rem",
              borderBottom: "1px solid var(--line)",
              background: "var(--surface)",
            }}
          >
            <Link href="/" style={{ fontWeight: 700, textDecoration: "none", color: "var(--ink)" }}>
              ❄️ SubZero
            </Link>
            <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <SignedIn>
                <Link href="/dashboard">Dashboard</Link>
                <UserButton />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="primary">Sign in with Google</button>
                </SignInButton>
              </SignedOut>
            </nav>
          </header>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
