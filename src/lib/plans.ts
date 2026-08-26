// The single source of truth for plan names, prices, and what each tier
// actually gives you (D5 structure, D7 prices, D10 A1).
//
// This module exists because the landing page and /pricing drifted into
// describing two different businesses: the landing still carried pre-D5 copy
// promising free users the whole product, including cancellation drafts the
// teaser never had. Copy that lives in two files diverges; copy that lives in
// one cannot. Every surface that names a plan — landing, /pricing, the
// paywall band, the Stripe mapping — reads from here, and
// tests/plan-consistency.test.ts fails the build if one starts inventing
// its own.
//
// Marketing surfaces are USD-only (D8.1). In-app money stays real
// per-currency and is never converted — that is `formatMinor`, not this.

export type PlanId = "teaser" | "basic" | "pro";

export interface Plan {
  id: PlanId;
  /** The name a customer sees. Never abbreviate it on one surface only. */
  name: string;
  monthly: string;
  annual: string | null;
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
    id: "teaser",
    name: "Free scan",
    monthly: "$0",
    annual: null,
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
    id: "basic",
    name: "Basic",
    monthly: "$4.99",
    annual: "$49",
    tagline: "cancel anytime — of course",
    features: [
      "Every subscription, unlocked",
      "Evidence log + price history for each",
      "Cancellation drafts, links, and tracking",
      "Monthly re-scan · 1 inbox",
    ],
    summary: "Every subscription unlocked, evidence and price history, cancellation tools.",
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: "$9.99",
    annual: "$99",
    tagline: "for people with many inboxes",
    features: [
      "Everything in Basic",
      "Unlimited connected inboxes",
      "Daily sync — catch new charges fast",
      "Renewal and price-increase alerts",
    ],
    summary: "Unlimited inboxes, daily sync, renewal and price-increase alerts.",
    featured: false,
  },
] as const;

/** True for the tiers that cost money. Never compare a price string. */
export function isPaid(plan: Plan): boolean {
  return plan.annual !== null;
}

export function planById(id: PlanId): Plan {
  const plan = PLANS.find((candidate) => candidate.id === id);
  if (!plan) throw new Error(`No plan named ${id}`);
  return plan;
}

/** The cheapest paid tier — what "unlock the full list from …" refers to. */
export const CHEAPEST_PAID = planById("basic");

/**
 * The teaser boundary, stated in one sentence.
 *
 * D10 A3: this has to appear BEFORE the Google consent screen, not only on
 * /pricing. Someone who grants inbox access and only then discovers most
 * rows are locked has been misled, however technically accurate the pricing
 * page was — that is a refund and a one-star review, earned.
 */
export const TEASER_BOUNDARY = `The free scan shows your totals and your biggest subscription. Unlock the full list from ${CHEAPEST_PAID.monthly}.`;
