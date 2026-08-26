import type { Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { Button } from "@/components/ui";

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
  // Graceful pre-configuration state: without Clerk keys, ClerkProvider (and
  // every Signed* component below) would throw on each request. Serve a
  // plain status page instead of a 500 until the environment is complete.
  // Requires BOTH keys, matching the middleware's check: with only the
  // publishable key, server routes (auth()/currentUser()) still throw on the
  // missing CLERK_SECRET_KEY.
  const clerkConfigured =
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
  if (!clerkConfigured) {
    return (
      <html lang="en">
        <body>
          <main className="mx-auto max-w-xl px-4 pt-24 text-center">
            <h1 className="text-2xl font-bold">❄️ SubZero is deployed</h1>
            <p className="mt-2 text-muted">
              The app is live but not configured yet: authentication keys are missing. Add the
              environment variables from <code>.env.example</code> in Vercel, then redeploy —
              environment changes only apply to new deployments.
            </p>
          </main>
        </body>
      </html>
    );
  }
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-extrabold tracking-tight">
                ❄️ SubZero
              </Link>
              <nav className="flex items-center gap-4">
                <SignedIn>
                  <Link
                    href="/dashboard"
                    className="text-sm font-medium text-muted transition-colors hover:text-ink"
                  >
                    Dashboard
                  </Link>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button>Sign in with Google</Button>
                  </SignInButton>
                </SignedOut>
              </nav>
            </div>
          </header>
          <Providers>
            <div className="flex-1">{children}</div>
          </Providers>
          <footer className="border-t border-line">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr]">
              <div>
                <p className="text-sm font-extrabold tracking-tight">❄️ SubZero</p>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">
                  Email-first subscription control. Read-only access; email bodies are processed in
                  memory and discarded.
                </p>
              </div>
              <nav className="text-xs">
                <p className="font-semibold">Product</p>
                <ul className="mt-2 space-y-1.5 text-muted">
                  <li>
                    <Link href="/#how" className="hover:text-ink">How it works</Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-ink">Pricing</Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
                  </li>
                </ul>
              </nav>
              <nav className="text-xs">
                <p className="font-semibold">Legal</p>
                <ul className="mt-2 space-y-1.5 text-muted">
                  <li>
                    <Link href="/privacy" className="hover:text-ink">Privacy policy</Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-ink">Terms of service</Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="border-t border-line py-4 text-center text-xs text-muted">
              © 2026 SubZero. All rights reserved.
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
