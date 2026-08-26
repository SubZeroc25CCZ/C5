import Link from "next/link";
import { EvidenceCard } from "./landing-mockups";
import { Faq, FinalCta, Hero, HowItWorks, PricingStrip, StickyCta } from "./landing-sections";

// Landing page — "From inbox chaos to total clarity".
//
// Honesty rules this page is built to (brief §2, and SCREEN_PLAN §10):
//   • Never "we don't touch your data" — we do read receipt emails, under a
//     read-only permission. Say read-only, no bank connection, revoke anytime.
//   • Never promise automatic or instant cancellation — SubZero prepares the
//     path; only provider confirmation counts as cancelled.
//   • No savings figures, success rates, or detection-accuracy claims: we
//     have no verified numbers, so we make no numeric promise at all.
// Every amount and merchant shown in the mockups is invented sample data.

const PAINS = [
  {
    title: "Charges you no longer recognize",
    body: "A name on a receipt that means nothing to you, six months after you stopped using it.",
    icon: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  },
  {
    title: "Prices that quietly increase",
    body: "The email said “an update to our terms”. The amount went up and stayed up.",
    icon: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  },
  {
    title: "Cancellation pages you can’t find",
    body: "Three menus deep, or an address that only takes email, or a phone line with hours.",
    icon: "M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z",
  },
];

const PRIVACY = [
  {
    title: "Read-only access",
    body: "SubZero cannot send, delete, or modify your email. The permission itself forbids it.",
  },
  {
    title: "No bank connection",
    body: "No card details, no banking credentials, no account linking. Only email receipts.",
  },
  {
    title: "Revoke anytime",
    body: "Disconnect from Settings, or revoke SubZero from your Google account directly.",
  },
];

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--lp-primary-bright)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      <Hero />

      {/* §C — problem strip. Minor tier of the vertical rhythm (D10 B3):
          connective sections breathe at 96px on desktop, the big set pieces
          (hero, how-it-works, pricing) keep 120px. */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 lg:py-24">
        <h2 className="lp-h2 lp-measure-title">
          Subscriptions are easy to start — and strangely hard to escape.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PAINS.map((pain) => (
            <div key={pain.title}>
              <Icon path={pain.icon} />
              <h3 className="lp-h3 mt-4">{pain.title}</h3>
              <p className="lp-body mt-2" style={{ color: "var(--lp-text-muted)" }}>
                {pain.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <HowItWorks />

      {/* §E — evidence, not guesses */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 lg:py-24">
        <h2 className="lp-h2 lp-measure-title">Every result comes with evidence.</h2>
        <p className="lp-body-lg lp-measure-copy mt-4" style={{ color: "var(--lp-text-muted)" }}>
          You can see exactly which receipts produced a subscription, and decide for yourself
          whether we got it right.
        </p>
        <div className="mt-10 max-w-2xl">
          <EvidenceCard />
        </div>
      </section>

      {/* §F — privacy */}
      <section className="lp-band">
        <div className="mx-auto max-w-[1200px] px-4 py-16 lg:py-24">
          <h2 className="lp-h2 lp-measure-title">Your inbox stays yours.</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {PRIVACY.map((item) => (
              <div key={item.title}>
                <h3 className="lp-h3" style={{ color: "var(--lp-primary-bright)" }}>
                  {item.title}
                </h3>
                <p className="lp-body mt-2" style={{ color: "var(--lp-text-muted)" }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <p className="lp-body lp-measure-copy mt-8" style={{ color: "var(--lp-text-muted)" }}>
            Message bodies are processed in memory and discarded. We keep the extracted facts —
            merchant, amount, date — and a reference so you can find the original receipt.{" "}
            <Link
              href="/privacy"
              className="font-semibold underline underline-offset-4"
              style={{ color: "var(--lp-primary-bright)" }}
            >
              Read the privacy policy
            </Link>
            .
          </p>
        </div>
      </section>

      <PricingStrip />
      <Faq />
      <FinalCta />

      {/* Sentinel: the sticky mobile CTA hides once this is on screen. */}
      <div id="lp-end" aria-hidden />
      <StickyCta />
    </div>
  );
}
