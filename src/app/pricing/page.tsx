import type { Metadata } from "next";
import Link from "next/link";
import { ProAction } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing — SubZero",
  description:
    "Free finds and explains every subscription in one inbox. Pro adds unlimited inboxes, daily re-scans, and alerts for $4.99/month.",
};

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-frost"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const FREE_FEATURES = [
  "1 connected inbox",
  "Full 24-month backfill scan",
  "Confirmed + possible subscriptions with evidence",
  "Price-change detection",
  "Cancellation drafts, links, and phone numbers",
  "Monthly re-scan",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited connected inboxes",
  "Daily re-scans — catch new charges fast",
  "Renewal and price-increase alerts first",
  "Priority support",
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-center text-4xl font-extrabold tracking-tight">
        Simple, honest pricing
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-center text-muted">
        The free plan is genuinely useful — it finds and explains everything in one inbox. Pro is
        for people with more inboxes, or less patience.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-7">
          <h2 className="text-lg font-semibold">Free</h2>
          <p className="tnum mt-2 text-4xl font-extrabold">$0</p>
          <p className="mt-1 text-sm text-muted">forever</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <Check />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center rounded-lg border border-frost px-4 py-3 text-sm font-medium text-frost transition-colors hover:bg-frost-soft"
            >
              Start free
            </Link>
          </div>
        </div>

        <div className="relative rounded-2xl border-2 border-frost bg-surface p-7">
          <span className="absolute -top-3 left-6 rounded-full bg-frost px-3 py-0.5 text-xs font-bold text-frost-ink">
            MOST POPULAR
          </span>
          <h2 className="text-lg font-semibold text-frost">Pro</h2>
          <p className="tnum mt-2 text-4xl font-extrabold">
            $4.99<span className="text-lg font-medium text-muted">/month</span>
          </p>
          <p className="mt-1 text-sm text-muted">cancel anytime — of course</p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <Check />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <ProAction />
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        Payments are handled by Stripe. We never see your card details — fitting, for a
        subscription-cancellation service, to make our own easy to cancel.
      </p>
    </main>
  );
}
