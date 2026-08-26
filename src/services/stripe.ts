// Stripe Pro billing (ported v1 pattern): checkout, portal, and a signed +
// idempotent webhook processor (§8 P0). Idempotency = event-id ledger in
// `webhook_events`; a replayed event id is a no-op. The processor works
// against a small BillingStore port so the logic is testable without MySQL.

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { profiles, webhookEvents } from "@/db/schema";

export function stripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

export type PaidPlan = "basic" | "pro";
export type BillingInterval = "monthly" | "annual";

/**
 * Price ids per (plan, interval) — decision D5's two-tier structure.
 * Defaults are the test-mode prices; env vars override for live mode.
 */
export function priceId(plan: PaidPlan, interval: BillingInterval): string {
  const prices: Record<PaidPlan, Record<BillingInterval, string>> = {
    basic: {
      monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY ?? "price_1U8a8vG8giGg4s7RLMhJz1mn",
      annual: process.env.STRIPE_PRICE_BASIC_ANNUAL ?? "price_1U8a8wG8giGg4s7RAtCEpclk",
    },
    pro: {
      monthly:
        process.env.STRIPE_PRICE_PRO_MONTHLY ??
        process.env.STRIPE_PRO_PRICE_ID ??
        "price_1U8XEcG8giGg4s7RBGZc0cqD",
      annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "price_1U8a8xG8giGg4s7RZcVsZhOG",
    },
  };
  const id = prices[plan][interval];
  if (!id) throw new Error(`No Stripe price configured for ${plan}/${interval}`);
  return id;
}

export async function createCheckoutSession(
  stripe: Stripe,
  input: {
    userId: string;
    email: string;
    customerId?: string | null;
    plan: PaidPlan;
    interval: BillingInterval;
  },
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId(input.plan, input.interval), quantity: 1 }],
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.email,
    client_reference_id: input.userId,
    // The plan rides on both the session and the subscription, so every
    // later webhook (updated/deleted) knows which tier it concerns.
    metadata: { plan: input.plan },
    subscription_data: { metadata: { plan: input.plan } },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(stripe: Stripe, customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });
  return session.url;
}

export interface PlanUpdate {
  plan: "teaser" | "basic" | "pro";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

/** The paid plan named in webhook metadata; legacy events default to pro. */
function paidPlanFromMetadata(metadata: Stripe.Metadata | null | undefined): PaidPlan {
  return metadata?.plan === "basic" ? "basic" : "pro";
}

export interface BillingStore {
  /** Record the event id; returns false if it was already recorded (duplicate). */
  recordEvent(id: string, type: string): Promise<boolean>;
  setPlanByUser(userId: string, update: PlanUpdate): Promise<void>;
  setPlanByCustomer(customerId: string, update: PlanUpdate): Promise<void>;
}

export function drizzleBillingStore(db: Database): BillingStore {
  return {
    async recordEvent(id, type) {
      const existing = await db
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(eq(webhookEvents.id, id))
        .limit(1);
      if (existing[0]) return false;
      await db.insert(webhookEvents).values({ id, type });
      return true;
    },
    async setPlanByUser(userId, update) {
      await db.update(profiles).set(update).where(eq(profiles.userId, userId));
    },
    async setPlanByCustomer(customerId, update) {
      await db.update(profiles).set(update).where(eq(profiles.stripeCustomerId, customerId));
    },
  };
}

export interface WebhookOutcome {
  handled: boolean;
  duplicate: boolean;
}

/**
 * Process a verified Stripe event exactly once. The caller is responsible
 * for signature verification (constructEvent) — this function assumes the
 * event is authentic and only enforces idempotency + state changes.
 */
export async function processStripeEvent(
  store: BillingStore,
  event: Stripe.Event,
): Promise<WebhookOutcome> {
  const fresh = await store.recordEvent(event.id, event.type);
  if (!fresh) return { handled: false, duplicate: true };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (!userId) return { handled: false, duplicate: false };
      await store.setPlanByUser(userId, {
        plan: paidPlanFromMetadata(session.metadata),
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : null,
      });
      return { handled: true, duplicate: false };
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (!customerId) return { handled: false, duplicate: false };
      await store.setPlanByCustomer(customerId, { plan: "teaser", stripeSubscriptionId: null });
      return { handled: true, duplicate: false };
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (!customerId) return { handled: false, duplicate: false };
      const active = subscription.status === "active" || subscription.status === "trialing";
      await store.setPlanByCustomer(customerId, {
        plan: active ? paidPlanFromMetadata(subscription.metadata) : "teaser",
      });
      return { handled: true, duplicate: false };
    }
    default:
      return { handled: false, duplicate: false };
  }
}
