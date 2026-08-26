"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useLandingEvents, type LandingEvent } from "./landing-analytics";
import { ActionsMock, ConnectMock, GroupingMock, HeroMockup, TimelineMock } from "./landing-mockups";

// Interactive parts of the landing page (conversion brief §B, §D, §G–I).
// Everything here is a client component only because it needs an event, an
// observer, or open/closed state — the static sections stay on the server.

const CTA_BASE =
  "lp-cta inline-flex items-center justify-center gap-2 px-6 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";
// 44px minimum hit target (brief §10) — py-3.5 on 16px text clears it.
const CTA_SIZE = "min-h-[52px] py-3.5 text-base";

function PrimaryCta({
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

/** §B — hero. Copy left, live dashboard right. */
export function Hero() {
  const { trackOnce } = useLandingEvents();

  // One per page load, from the section that is always on screen at load.
  useEffect(() => {
    trackOnce("landing_view");
  }, [trackOnce]);

  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-20 lg:grid-cols-[5fr_7fr] lg:py-[120px]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--lp-primary-bright)" }}>
          AI-powered subscription control
        </p>
        <h1 className="lp-hero-title lp-measure-title mt-4">
          Still paying for subscriptions you forgot about?
        </h1>
        <p className="lp-body-lg lp-measure-copy mt-5" style={{ color: "var(--lp-text-muted)" }}>
          SubZero finds recurring charges in your email receipts, flags price changes, and helps you
          cancel — without connecting your bank.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <PrimaryCta event="hero_cta_clicked" className="w-full sm:w-auto">
            Scan my inbox securely
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
          Read-only access &middot; No bank connection &middot; Revoke anytime
        </p>
      </div>

      <div id="hero-mockup">
        <HeroMockup />
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: 1,
    title: "Connect securely",
    copy: "Connect Gmail with secure, read-only access. Never share your email or bank password.",
    Visual: ConnectMock,
  },
  {
    n: 2,
    title: "AI finds the recurring charges",
    copy: "SubZero analyzes receipt patterns and groups recurring charges by merchant, amount, and date.",
    Visual: GroupingMock,
  },
  {
    n: 3,
    title: "See the full story",
    copy: "Review evidence, renewal dates, and price changes in one clear dashboard.",
    Visual: TimelineMock,
  },
  {
    n: 4,
    title: "Keep, cancel, or ignore",
    copy: "Choose what stays. For anything you want to stop, get the clearest available cancellation path.",
    Visual: ActionsMock,
  },
] as const;

/**
 * §D — how it works. Sticky scrollytelling on desktop, stacked cards on
 * mobile. The steps are readable as four plain cards with no scripting at
 * all, so the section survives reduced motion and a failed hydrate.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const { trackOnce } = useLandingEvents();

  useEffect(() => {
    const nodes = stepRefs.current.filter(Boolean) as HTMLDivElement[];
    if (nodes.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.step);
          setActive(index);
          trackOnce("demo_step_viewed", index + 1);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [trackOnce]);

  const ActiveVisual = STEPS[active]!.Visual;

  return (
    <section id="how-it-works" className="mx-auto max-w-[1200px] px-4 py-20 lg:py-[120px]">
      <h2 className="lp-h2 lp-measure-title">From inbox chaos to total clarity.</h2>
      <p className="lp-body-lg lp-measure-copy mt-4" style={{ color: "var(--lp-text-muted)" }}>
        Four steps, about two minutes.
      </p>

      <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Steps */}
        <ol className="flex flex-col gap-6 lg:gap-[120px]">
          {STEPS.map((step, index) => {
            const Visual = step.Visual;
            return (
              <li key={step.n}>
                <div
                  ref={(node) => {
                    stepRefs.current[index] = node;
                  }}
                  data-step={index}
                  className="transition-opacity duration-[350ms]"
                  style={{ opacity: active === index ? 1 : 0.55 }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{
                        background: active === index ? "var(--lp-primary)" : "rgba(255,255,255,0.08)",
                        color: active === index ? "#04111f" : "var(--lp-text-muted)",
                      }}
                    >
                      {step.n}
                    </span>
                    <h3 className="lp-h3">{step.title}</h3>
                  </div>
                  <p className="lp-body lp-measure-copy mt-3" style={{ color: "var(--lp-text-muted)" }}>
                    {step.copy}
                  </p>
                  {/* Mobile: each step carries its own visual inline. */}
                  <div className="mt-5 lg:hidden">
                    <Visual />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Desktop: one sticky visual that swaps. */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <div
              key={active}
              className="transition-opacity duration-[350ms]"
              style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
            >
              <ActiveVisual />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-14 flex justify-center">
        <PrimaryCta event="hero_cta_clicked">Find my subscriptions</PrimaryCta>
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
    q: "Can SubZero cancel subscriptions automatically?",
    a: "No. SubZero gives you the clearest available path — a direct cancellation link, a phone number, or a prepared email you send yourself. A subscription counts as cancelled only when the provider confirms it, and that is what the status will say.",
  },
  {
    q: "What happens when a merchant changes its name?",
    a: "Charges are grouped by sender domain and amount pattern as well as name, so a rename usually stays one subscription. When it doesn't, you can correct the merchant on the subscription and the correction sticks.",
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
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 lg:py-[120px]">
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
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: "var(--lp-primary-bright)" }}>
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

/** §G — pricing strip. Real tiers and real prices; the table lives on /pricing. */
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

  const tiers = [
    { name: "Free scan", price: "$0", note: "Your totals and your most expensive subscription, with evidence.", featured: false },
    { name: "Basic", price: "$4.99", note: "Every subscription unlocked, evidence and price history, cancellation tools.", featured: true },
    { name: "Pro", price: "$9.99", note: "Unlimited inboxes, daily sync, renewal and price-increase alerts.", featured: false },
  ];

  return (
    <section id="pricing" ref={ref} className="mx-auto max-w-[1200px] px-4 py-20 lg:py-[120px]">
      <h2 className="lp-h2">Simple enough to start today.</h2>
      <p className="lp-body-lg lp-measure-copy mt-4" style={{ color: "var(--lp-text-muted)" }}>
        The scan is free. You only pay when you want the full list and the tools to act on it.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="relative p-6"
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
                Most control
              </span>
            )}
            <div className="lp-h3">{tier.name}</div>
            <div className="mt-2 text-3xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {tier.price}
              {tier.price !== "$0" && (
                <span className="text-base font-medium" style={{ color: "var(--lp-text-muted)" }}>/month</span>
              )}
            </div>
            <p className="lp-small mt-3" style={{ color: "var(--lp-text-muted)" }}>{tier.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href="/pricing"
          onClick={() => track("pricing_viewed")}
          className="lp-small font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: "var(--lp-primary-bright)", outlineColor: "var(--lp-primary-bright)" }}
        >
          Compare the plans in full
        </Link>
      </div>
    </section>
  );
}

/** §I — final CTA. */
export function FinalCta() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center lg:py-[120px]">
      <h2 className="lp-h2">Stop wondering where your money is going.</h2>
      <p className="lp-body-lg mt-4" style={{ color: "var(--lp-text-muted)" }}>
        See the recurring charges already hiding in your inbox.
      </p>
      <div className="mt-8 flex justify-center">
        <PrimaryCta event="final_cta_clicked">Scan my inbox securely</PrimaryCta>
      </div>
      <p className="lp-small mt-5" style={{ color: "var(--lp-text-muted)" }}>
        No bank connection. Revoke access anytime.
      </p>
    </section>
  );
}

/**
 * Mobile sticky CTA (brief §9): appears once the hero CTA has scrolled out
 * of view, hides again near the footer so it never covers the final CTA.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-mockup");
    const footerSentinel = document.getElementById("lp-end");
    if (typeof IntersectionObserver === "undefined") return;

    let heroGone = false;
    let atEnd = false;
    const sync = () => setVisible(heroGone && !atEnd);

    const observers: IntersectionObserver[] = [];
    if (hero) {
      const o = new IntersectionObserver(
        ([entry]) => {
          heroGone = !entry!.isIntersecting && entry!.boundingClientRect.top < 0;
          sync();
        },
        { threshold: 0 },
      );
      o.observe(hero);
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
    >
      <div className={visible ? "" : "pointer-events-none"}>
        <PrimaryCta event="hero_cta_clicked" className="w-full">
          Scan my inbox securely
        </PrimaryCta>
      </div>
    </div>
  );
}
