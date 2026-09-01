"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useLandingEvents, type LandingEvent } from "./landing-analytics";
import { GUARDIAN, PASS, PLANS, TEASER_BOUNDARY } from "@/lib/plans";

// Interactive parts of the landing page. Everything here is a client
// component only because it needs an event, an observer, or open/closed
// state — the static sections stay on the server.
//
// One hard rule, post-facelift: every element that looks pressable IS
// pressable and does something real. No decorative buttons.

const CTA_BASE =
  "lp-cta inline-flex items-center justify-center gap-2 px-6 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";
// 44px minimum hit target (brief §10) — py-3.5 on 16px text clears it.
const CTA_SIZE = "min-h-[52px] py-3.5 text-base";

export function PrimaryCta({
  children,
  event,
  className,
}: {
  children: React.ReactNode;
  event: LandingEvent;
  className?: string;
}) {
  const { track } = useLandingEvents();
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const router = useRouter();

  // Deliberately NOT wrapped in <SignedOut>/<SignedIn>. Those render nothing
  // until Clerk resolves on the client, which kept the primary CTA — the one
  // thing this page exists to get clicked — out of the server HTML entirely.
  // The button is always in the markup; only its behaviour waits for auth.
  // Signed-in visitors are a rounding error on a landing page, so the
  // marketing label is the correct pre-hydration text for everyone.
  const signedIn = isLoaded && isSignedIn;

  return (
    <button
      onClick={() => {
        track(event);
        if (signedIn) router.push("/dashboard");
        else openSignIn({});
      }}
      className={`${CTA_BASE} ${CTA_SIZE} ${className ?? ""}`}
      style={{
        borderRadius: "var(--lp-radius-button)",
        background: "var(--lp-primary)",
        color: "#04111f",
        outlineColor: "var(--lp-primary-bright)",
      }}
    >
      {signedIn ? "Open your dashboard" : children}
    </button>
  );
}

/** §B — hero. Copy left, real dashboard screenshot right. */
export function Hero({ mockup }: { mockup: React.ReactNode }) {
  const { trackOnce } = useLandingEvents();

  // One per page load, from the section that is always on screen at load.
  useEffect(() => {
    trackOnce("landing_view");
  }, [trackOnce]);

  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 lg:grid-cols-[10fr_11fr] lg:py-24">
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--lp-primary-bright)" }}
        >
          Find · Understand · Cancel
        </p>
        <h1 className="lp-hero-title lp-measure-title mt-4">
          Still paying for things you forgot?
        </h1>
        <p className="lp-body-lg lp-measure-copy mt-5" style={{ color: "var(--lp-text-muted)" }}>
          SubZero reads your email receipts — read-only, no bank connection — and shows every
          recurring charge, every quiet price increase, and the clearest way out of each one.
        </p>

        <div id="hero-cta" className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <PrimaryCta event="hero_cta_clicked" className="w-full sm:w-auto">
            Scan my inbox — free
          </PrimaryCta>
          <a
            href="#how-it-works"
            className={`${CTA_BASE} ${CTA_SIZE} w-full sm:w-auto`}
            style={{
              borderRadius: "var(--lp-radius-button)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "var(--lp-text)",
              outlineColor: "var(--lp-primary-bright)",
            }}
          >
            See how it works
          </a>
        </div>

        <p className="lp-small mt-5" style={{ color: "var(--lp-text-muted)" }}>
          Read-only access · No bank connection · Revoke anytime
        </p>
      </div>

      <div id="hero-mockup">{mockup}</div>
    </section>
  );
}

const STEPS = [
  {
    n: 1,
    title: "Connect securely",
    copy: "Gmail, with a read-only grant. SubZero cannot send, delete, or edit anything — the permission itself forbids it.",
    icon: "M4 6h16v12H4zM4 7l8 6 8-6",
  },
  {
    n: 2,
    title: "We find the recurring charges",
    copy: "Receipts are grouped by merchant, amount, and cadence — up to 24 months back, in about two minutes.",
    icon: "M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z",
  },
  {
    n: 3,
    title: "See the full story",
    copy: "Every subscription with its receipts, renewal dates, and price history — evidence, not guesses.",
    icon: "M3 3v18h18M7 15l4-6 3 3 5-8",
  },
  {
    n: 4,
    title: "Keep, cancel, or ignore",
    copy: "For anything you want to stop: a direct link, a phone number, or a prepared email. Done only after provider confirmation.",
    icon: "M20 6L9 17l-5-5",
  },
] as const;

/**
 * §D — how it works. A plain numbered grid: no scroll scripting, no sticky
 * panels, nothing that can look broken mid-scroll. The old scrollytelling
 * left steps 2–4 floating beside an empty column on tall screens — the
 * facelift trades the trick for legibility.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="lp-band">
      <div className="mx-auto max-w-[1200px] px-4 py-16 lg:py-24">
        <h2 className="lp-h2 lp-measure-title">From inbox chaos to total clarity.</h2>
        <p className="lp-body-lg lp-measure-copy mt-4" style={{ color: "var(--lp-text-muted)" }}>
          Four steps, about two minutes.
        </p>

        <ol className="mt-12 grid gap-5 md:grid-cols-2">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="p-6 lg:p-7"
              style={{
                borderRadius: "var(--lp-radius-card)",
                background: "var(--lp-surface)",
                border: "1px solid var(--lp-hairline)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: "var(--lp-primary)", color: "#04111f" }}
                >
                  {step.n}
                </span>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--lp-primary-bright)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={step.icon} />
                </svg>
                <h3 className="lp-h3">{step.title}</h3>
              </div>
              <p className="lp-body mt-3" style={{ color: "var(--lp-text-muted)" }}>
                {step.copy}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex justify-center">
          <PrimaryCta event="hero_cta_clicked">Find my subscriptions</PrimaryCta>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "Can SubZero read all my email?",
    a: "SubZero requests read-only access and searches for billing and receipt emails from merchants it recognises. It cannot send, delete or modify anything. Read-only is a technical limit of the permission, not a promise about our behaviour.",
  },
  {
    q: "Do you store my emails?",
    a: "No. Message bodies are processed in memory and discarded. What we keep is the extracted facts — merchant, amount, date, and the message reference so you can find the original receipt yourself.",
  },
  {
    q: "Do I need to connect my bank?",
    a: "Never. SubZero works entirely from your email receipts. We ask for no card details and no banking credentials.",
  },
  {
    q: "What does it cost?",
    a: `The scan is free and shows your totals plus your most expensive subscription. One ${PASS.price} payment — not a subscription — unlocks everything for 30 days. Guardian (${GUARDIAN.price}/year) is optional and keeps re-scanning after the cleanup.`,
  },
  {
    q: "Can SubZero cancel subscriptions automatically?",
    a: "No. SubZero gives you the clearest available path — a direct cancellation link, a phone number, or a prepared email you send yourself. A subscription counts as cancelled only when the provider confirms it, and that is what the status will say.",
  },
  {
    q: "How do I revoke access or delete my account?",
    a: "Disconnect the inbox from Settings at any time, or revoke SubZero from your Google account directly. Deleting your account removes the extracted facts we derived from your receipts.",
  },
];

/** §H — FAQ. Native details/summary, so it works without JS and with a keyboard. */
export function Faq() {
  const { trackOnce } = useLandingEvents();
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 lg:py-24">
      <h2 className="lp-h2">Questions worth asking.</h2>
      <div className="mt-10 flex flex-col gap-3">
        {FAQ.map((item, index) => (
          <details
            key={item.q}
            className="group px-5 py-4"
            style={{
              borderRadius: "var(--lp-radius-card)",
              background: "var(--lp-surface)",
              border: "1px solid var(--lp-hairline)",
            }}
            onToggle={(event) => {
              if ((event.currentTarget as HTMLDetailsElement).open) {
                trackOnce("faq_opened", index + 1);
              }
            }}
          >
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: "var(--lp-primary-bright)" }}
            >
              {item.q}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--lp-primary-bright)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 transition-transform duration-200 group-open:rotate-45"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p className="lp-body mt-3" style={{ color: "var(--lp-text-muted)" }}>
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** §G — pricing strip. Real tiers, real prices, and a real button on each card. */
export function PricingStrip() {
  const { trackOnce, track } = useLandingEvents();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) trackOnce("pricing_viewed");
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [trackOnce]);

  return (
    <section id="pricing" ref={ref} className="mx-auto max-w-[1200px] px-4 py-16 lg:py-24">
      <h2 className="lp-h2">Simple enough to start today.</h2>
      <p className="lp-body-lg lp-measure-copy mt-4" style={{ color: "var(--lp-text-muted)" }}>
        {TEASER_BOUNDARY}
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {PLANS.map((tier) => (
          <div
            key={tier.id}
            className="relative flex flex-col p-6"
            style={{
              borderRadius: "var(--lp-radius-card)",
              background: "var(--lp-surface)",
              border: tier.featured ? "2px solid var(--lp-primary)" : "1px solid var(--lp-hairline)",
            }}
          >
            {tier.featured && (
              <span
                className="absolute -top-3 left-5 rounded-full px-3 py-0.5 text-xs font-bold"
                style={{ background: "var(--lp-primary)", color: "#04111f" }}
              >
                The unlock
              </span>
            )}
            <div className="lp-h3">{tier.name}</div>
            <div className="mt-2 text-3xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {tier.price}
              {tier.cadence && (
                <span className="text-base font-medium" style={{ color: "var(--lp-text-muted)" }}>
                  {" "}
                  {tier.cadence}
                </span>
              )}
            </div>
            <p className="lp-small mt-3 flex-1" style={{ color: "var(--lp-text-muted)" }}>
              {tier.summary}
            </p>
            <div className="mt-5">
              {tier.id === "free" ? (
                <PrimaryCta event="pricing_viewed" className="w-full !min-h-[44px] !py-2.5 !text-sm">
                  Start the free scan
                </PrimaryCta>
              ) : (
                <Link
                  href="/pricing"
                  onClick={() => track("pricing_viewed")}
                  className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "var(--lp-text)",
                    outlineColor: "var(--lp-primary-bright)",
                  }}
                >
                  {tier.id === "pass" ? "Get the Cleanup Pass" : "See Guardian"}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** §I — final CTA. */
export function FinalCta() {
  return (
    <section className="lp-band-glow">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center lg:py-[120px]">
        <h2 className="lp-h2">Stop wondering where your money is going.</h2>
        <p className="lp-body-lg mt-4" style={{ color: "var(--lp-text-muted)" }}>
          See the recurring charges already hiding in your inbox.
        </p>
        <div className="mt-8 flex justify-center">
          <PrimaryCta event="final_cta_clicked">Scan my inbox — free</PrimaryCta>
        </div>
        <p className="lp-small mt-5" style={{ color: "var(--lp-text-muted)" }}>
          No bank connection. Revoke access anytime.
        </p>
      </div>
    </section>
  );
}

/**
 * Mobile sticky CTA (brief §9): appears only after the hero's own CTA has
 * scrolled fully out of view (observing the CTA itself, not the mockup —
 * observing the mockup made the bar show while the hero button was still on
 * screen, stacking two identical buttons), and hides near the footer so it
 * never covers the final CTA.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const heroCta = document.getElementById("hero-cta");
    const footerSentinel = document.getElementById("lp-end");
    if (typeof IntersectionObserver === "undefined") return;

    let heroGone = false;
    let atEnd = false;
    const sync = () => setVisible(heroGone && !atEnd);

    const observers: IntersectionObserver[] = [];
    if (heroCta) {
      const o = new IntersectionObserver(
        ([entry]) => {
          heroGone = !entry!.isIntersecting && entry!.boundingClientRect.bottom < 0;
          sync();
        },
        { threshold: 0 },
      );
      o.observe(heroCta);
      observers.push(o);
    }
    if (footerSentinel) {
      const o = new IntersectionObserver(
        ([entry]) => {
          atEnd = entry!.isIntersecting;
          sync();
        },
        { threshold: 0 },
      );
      o.observe(footerSentinel);
      observers.push(o);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 p-3 transition-transform duration-300 lg:hidden"
      style={{
        transform: visible ? "translateY(0)" : "translateY(120%)",
        background: "linear-gradient(to top, var(--lp-bg) 65%, transparent)",
      }}
      aria-hidden={!visible}
      // Focus must go where sight goes: while hidden the button would still
      // be tab-reachable, so the subtree is inert too (Lighthouse
      // aria-hidden-focus).
      inert={!visible}
    >
      <div className={visible ? "" : "pointer-events-none"}>
        <PrimaryCta event="hero_cta_clicked" className="w-full">
          Scan my inbox — free
        </PrimaryCta>
      </div>
    </div>
  );
}
