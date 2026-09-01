// Stripe billing (D11 pricing pivot): a one-time Cleanup Pass, an annual
// Guardian subscription, checkout + portal, and a signed + idempotent
// webhook processor (§8 P0). Idempotency = event-id ledger in
// `webhook_events`; a replayed event id is a no-op. The processor works
// against a small BillingStore port so the logic is testable without a
// database.

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { profiles, webhookEvents } from "@/db/schema";

export function stripeClient(): Stripe {
  // The guard belongs HERE, not in the functions that take a Stripe client:
  // every caller constructs the client first, and the SDK constructor throws
  // "Neither apiKey nor config.authenticator provided" on an empty key —
  // which reaches the logs without naming the variable anyone needs to set.
  requireStripeKey();
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });
}

/** Guard the key itself: an empty key fails deep inside Stripe's SDK. */
function requireStripeKey(): void {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — billing is not configured. " +
        "Set it in the deployment environment.",
    );
  }
}

/** The two things money buys (D11). */
export type Purchase = "pass" | "guardian";

/**
 * LIVE price ids, created on the production Stripe account — the defaults,
 * so a fresh deployment needs no price env vars at all. The env overrides
 * exist for a future price test, and are REQUIRED under a test-mode key
 * (these ids do not exist there, and the failure would otherwise be a bare
 * 500 at checkout — the exact incident the old fallback design caused).
 */
const LIVE_PRICES: Record<Purchase, string> = {
  pass: "price_1UAnF0G8giGg4s7RCHCAQgO3", // SubZero Cleanup Pass — $14.99 one-time
  guardian: "price_1UAnF6G8giGg4s7RnhQhGXLy", // SubZero Guardian — $19/year
};

const PRICE_ENV: Record<Purchase, string> = {
  pass: "STRIPE_PRICE_PASS",
  guardian: "STRIPE_PRICE_GUARDIAN",
};

export function priceId(purchase: Purchase): string {
  const configured = process.env[PRICE_ENV[purchase]];
  if (configured) return configured;
  if (!isLiveKey()) {
    throw new Error(
      `Stripe is in test mode but ${PRICE_ENV[purchase]} is not set. ` +
        "The built-in price ids are live-mode and do not exist on a test account: " +
        "set STRIPE_PRICE_PASS and STRIPE_PRICE_GUARDIAN to test prices, or use the live key.",
    );
  }
  return LIVE_PRICES[purchase];
}

function isLiveKey(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}

/** How long a Cleanup Pass lasts, from the moment payment completes. */
export const PASS_DURATION_MS = 30 * 86_400_000;

/** The app's public origin, which Stripe requires for its return URLs. */
function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set — Stripe checkout needs it for success_url and cancel_url.",
    );
  }
  return url.replace(/\/$/, "");
}

export async function createCheckoutSession(
  stripe: Stripe,
  input: {
    userId: string;
    email: string;
    customerId?: string | null;
    purchase: Purchase;
  },
): Promise<string> {
  const origin = appUrl();
  const subscription = input.purchase === "guardian";
  const session = await stripe.checkout.sessions.create({
    mode: subscription ? "subscription" : "payment",
    line_items: [{ price: priceId(input.purchase), quantity: 1 }],
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.email,
    // Payment mode doesn't create a customer by default; we want one so the
    // billing portal and receipts work for Pass buyers too. Stripe rejects
    // customer_creation when an existing customer is passed, so it is only
    // set for first-time buyers.
    ...(subscription || input.customerId ? {} : { customer_creation: "always" as const }),
    client_reference_id: input.userId,
    // The purchase rides on the session (and the subscription, when there is
    // one), so every later webhook knows what was bought.
    metadata: { product: input.purchase },
    ...(subscription ? { subscription_data: { metadata: { product: input.purchase } } } : {}),
    // Promotion codes (e.g. launch coupons) are created in the Stripe
    // dashboard; this only reveals the "Add promotion code" field at
    // checkout. No code, no change.
    allow_promotion_codes: true,
    success_url: `${origin}/checkout/success`,
    cancel_url: `${origin}/pricing`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(stripe: Stripe, customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl()}/dashboard`,
  });
  return session.url;
}

/** What a webhook may change about a profile's billing state. */
export interface BillingUpdate {
  plan?: "free" | "guardian";
  passExpiresAt?: Date;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

export interface BillingStore {
  /** Record the event id; returns false if it was already recorded (duplicate). */
  recordEvent(id: string, type: string): Promise<boolean>;
  updateByUser(userId: string, update: BillingUpdate): Promise<void>;
  updateByCustomer(customerId: string, update: BillingUpdate): Promise<void>;
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
    async updateByUser(userId, update) {
      await db.update(profiles).set(update).where(eq(profiles.userId, userId));
    },
    async updateByCustomer(customerId, update) {
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
    // async_payment_succeeded is the completion signal for delayed payment
    // methods (ACH and friends). None are enabled today, but handling it now
    // means turning one on in the Stripe dashboard cannot silently create
    // paid-but-locked-out customers.
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (!userId) return { handled: false, duplicate: false };
      const customerId = typeof session.customer === "string" ? session.customer : null;

      if (session.metadata?.product === "guardian" || session.mode === "subscription") {
        // Guardian (or a legacy pre-pivot subscription link): guardian-level
        // access, managed by the subscription events below from here on.
        await store.updateByUser(userId, {
          plan: "guardian",
          stripeCustomerId: customerId,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : null,
        });
        return { handled: true, duplicate: false };
      }

      // Access is granted for MONEY RECEIVED, not checkout completed: with a
      // delayed payment method, "completed" fires while payment_status is
      // still "unpaid", and the payment can later fail. The unpaid session's
      // Pass is granted by async_payment_succeeded instead.
      if (session.payment_status !== "paid") {
        return { handled: false, duplicate: false };
      }

      // Cleanup Pass: 30 days of full access from the moment Stripe says the
      // payment completed — the event's own clock, not ours, so a delayed
      // webhook delivery never shortens what was paid for.
      await store.updateByUser(userId, {
        passExpiresAt: new Date(event.created * 1000 + PASS_DURATION_MS),
        stripeCustomerId: customerId,
      });
      return { handled: true, duplicate: false };
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (!customerId) return { handled: false, duplicate: false };
      // Only the subscription ends — an unexpired Pass on the same profile
      // keeps working, because passExpiresAt is untouched.
      await store.updateByCustomer(customerId, { plan: "free", stripeSubscriptionId: null });
      return { handled: true, duplicate: false };
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (!customerId) return { handled: false, duplicate: false };
      const active = subscription.status === "active" || subscription.status === "trialing";
      await store.updateByCustomer(customerId, { plan: active ? "guardian" : "free" });
      return { handled: true, duplicate: false };
    }
    default:
      return { handled: false, duplicate: false };
  }
}
