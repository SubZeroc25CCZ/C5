import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Providers } from "./providers";
import { SiteFooter, SiteHeader } from "./site-chrome";

// Typography (ui-ux-pro-max + the frost identity): Sora for display —
// geometric and cold, matching the brand — Plus Jakarta Sans for body, the
// finance/B2B legibility pick. Self-hosted by next/font: no layout shift,
// no external requests.
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const display = Sora({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-sora" });

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
      <html lang="en" className={`${body.variable} ${display.variable}`}>
        <body>
          <main className="mx-auto max-w-xl px-4 pt-24 text-center">
            <h1 className="text-2xl font-bold">SubZero is deployed</h1>
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
      <html lang="en" className={`${body.variable} ${display.variable}`}>
        <body className="flex min-h-screen flex-col">
          <SiteHeader />
          <Providers>
            <div className="flex-1">{children}</div>
          </Providers>
          <SiteFooter />
        </body>
      </html>
    </ClerkProvider>
  );
}
