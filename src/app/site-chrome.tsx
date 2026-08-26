"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { SnowflakeIcon } from "@/components/icons";

// The landing page is an always-dark marketing surface; the product is a
// light (or system-themed) app. A single light header sticking over the dark
// hero was the visible seam, so the chrome takes a variant per route rather
// than the page fighting the layout.

const LANDING_NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

function Wordmark({ dark, size = 22 }: { dark: boolean; size?: number }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight"
      style={dark ? { color: "var(--lp-text)" } : undefined}
    >
      <SnowflakeIcon
        width={size}
        height={size}
        className={dark ? undefined : "text-frost"}
        style={dark ? { color: "var(--lp-primary-bright)" } : undefined}
      />
      SubZero
    </Link>
  );
}

function LandingHeaderCta() {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const router = useRouter();
  const signedIn = isLoaded && isSignedIn;

  // Same reasoning as PrimaryCta: <SignedOut> keeps the button out of the
  // server HTML until Clerk resolves, and the header CTA is persistent by
  // design — it should never be the thing that pops in late.
  return (
    <button
      onClick={() => (signedIn ? router.push("/dashboard") : openSignIn({}))}
      className="lp-cta inline-flex min-h-11 items-center px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        borderRadius: "var(--lp-radius-button)",
        background: "var(--lp-primary)",
        color: "#04111f",
        outlineColor: "var(--lp-primary-bright)",
      }}
    >
      {signedIn ? "Dashboard" : "Scan my inbox"}
    </button>
  );
}

export function SiteHeader() {
  const isLanding = usePathname() === "/";

  if (!isLanding) {
    return (
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Wordmark dark={false} />
          <nav className="flex items-center gap-4">
            <SignedIn>
              <Link href="/dashboard" className="text-sm font-medium text-muted transition-colors hover:text-ink">
                Dashboard
              </Link>
              <Link
                href="/dashboard/cancellations"
                className="text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                Cancellations
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
    );
  }

  return (
    <header
      className="lp sticky top-0 z-30 backdrop-blur"
      style={{ background: "rgba(7,20,37,0.82)", borderBottom: "1px solid var(--lp-hairline)" }}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3">
        <Wordmark dark />
        {/* Brief §A: on mobile only the logo and the CTA survive. */}
        <nav className="hidden items-center gap-6 md:flex">
          {LANDING_NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: "var(--lp-text-muted)", outlineColor: "var(--lp-primary-bright)" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LandingHeaderCta />
      </div>
    </header>
  );
}

const FOOTER_LINKS = {
  Product: [
    { href: "/#how-it-works", label: "How it works" },
    { href: "/pricing", label: "Pricing" },
    { href: "/dashboard", label: "Dashboard" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy policy" },
    { href: "/terms", label: "Terms of service" },
  ],
};

export function SiteFooter() {
  const isLanding = usePathname() === "/";
  const dark = isLanding;

  return (
    <footer
      className={dark ? "lp" : "border-t border-line"}
      style={dark ? { borderTop: "1px solid var(--lp-hairline)" } : undefined}
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p
            className="flex items-center gap-1.5 font-display text-sm font-extrabold tracking-tight"
            style={dark ? { color: "var(--lp-text)" } : undefined}
          >
            <SnowflakeIcon
              width={16}
              height={16}
              className={dark ? undefined : "text-frost"}
              style={dark ? { color: "var(--lp-primary-bright)" } : undefined}
            />
            SubZero
          </p>
          <p
            className="mt-2 max-w-xs text-xs leading-relaxed"
            style={dark ? { color: "var(--lp-text-muted)" } : undefined}
          >
            <span className={dark ? undefined : "text-muted"}>
              Email-first subscription control. Read-only access; email bodies are processed in
              memory and discarded.
            </span>
          </p>
        </div>
        {Object.entries(FOOTER_LINKS).map(([group, links]) => (
          <nav key={group} className="text-xs">
            <p className="font-semibold" style={dark ? { color: "var(--lp-text)" } : undefined}>
              {group}
            </p>
            <ul className="mt-2 space-y-1.5">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={dark ? "hover:underline" : "text-muted hover:text-ink"}
                    style={dark ? { color: "var(--lp-text-muted)" } : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div
        className="py-4 text-center text-xs"
        style={
          dark
            ? { borderTop: "1px solid var(--lp-hairline)", color: "var(--lp-text-muted)" }
            : undefined
        }
      >
        <span className={dark ? undefined : "border-t border-line text-muted"}>
          © 2026 SubZero. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
