// The single source of truth for tier names, prices, and what each gives you
// (D11 pricing pivot — supersedes D5/D7's monthly tiers).
//
// The model, in one breath: the scan is free, the cleanup is a ONE-TIME
// purchase, and ongoing watch is a cheap ANNUAL plan. A product that exists
// to kill forgotten subscriptions does not fund itself by becoming one.
//
// Every surface that names a tier — landing, /pricing, the paywall band, the
// Stripe mapping, the survey — reads from here, and
// tests/plan-consistency.test.ts fails the build if one starts inventing
// its own. Marketing surfaces are USD-only (D8.1). In-app money stays real
// per-currency and is never converted — that is `formatMinor`, not this.

export type PlanId = "free" | "pass" | "guardian";

export interface Plan {
  id: PlanId;
  /** The name a customer sees. Never abbreviate it on one surface only. */
  name: string;
  /** The price as shown ("$0", "$14.99", "$19"). */
  price: string;
  /** What the price means ("one-time", "per year"); null for free. */
  cadence: string | null;
  /** One line under the price. */
  tagline: string;
  /** The full bullet list, in order. */
  features: readonly string[];
  /** A single sentence for compact surfaces (landing strip, paywalls). */
  summary: string;
  featured: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free scan",
    price: "$0",
    cadence: null,
    tagline: "see what you’re dealing with",
    features: [
      "Full 24-month inbox scan",
      "Per-currency monthly + yearly totals",
      "How many subscriptions we found",
      "Your most expensive subscription — full detail and evidence",
    ],
    summary: "Your totals and your most expensive subscription, with evidence.",
    featured: false,
  },
  {
    id: "pass",
    name: "Cleanup Pass",
    price: "$14.99",
    cadence: "one-time",
    tagline: "one payment · 30 days of full access",
    features: [
      "Every subscription unlocked, with evidence and price history",
      "All cancellation tools — drafts, links, tracking. Unlimited.",
      "Re-scan daily for 30 days to confirm the charges stopped",
      "No recurring charge — when it ends, it just ends",
    ],
    summary: "Everything unlocked and every cancellation tool, for one payment — no subscription.",
    featured: true,
  },
  {
    id: "guardian",
    name: "Guardian",
    price: "$19",
    cadence: "per year",
    tagline: "we keep watch after the cleanup",
    features: [
      "Monthly automatic re-scan",
      "Price-increase alerts — the quiet ones",
      "New-subscription detection",
      "Up to 3 connected inboxes",
    ],
    summary: "Ongoing watch: monthly re-scans, price-increase alerts, new-subscription detection.",
    featured: false,
  },
] as const;

/** True for the tiers that cost money. Never compare a price string. */
export function isPaid(plan: Plan): boolean {
  return plan.cadence !== null;
}

export function planById(id: PlanId): Plan {
  const plan = PLANS.find((candidate) => candidate.id === id);
  if (!plan) throw new Error(`No plan named ${id}`);
  return plan;
}

/** The unlock purchase — what every paywall points at. */
export const PASS = planById("pass");
export const GUARDIAN = planById("guardian");

/**
 * The free-tier boundary, stated in one sentence.
 *
 * D10 A3: this has to appear BEFORE the Google consent screen, not only on
 * /pricing. Someone who grants inbox access and only then discovers most
 * rows are locked has been misled, however technically accurate the pricing
 * page was — that is a refund and a one-star review, earned.
 */
export const TEASER_BOUNDARY = `The free scan shows your totals and your biggest subscription. Unlock the full list for ${PASS.price} — one payment, no subscription.`;
