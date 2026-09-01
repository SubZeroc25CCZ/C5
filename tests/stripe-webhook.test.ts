import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  PASS_DURATION_MS,
  processStripeEvent,
  type BillingStore,
  type BillingUpdate,
} from "../src/services/stripe";

function memoryStore() {
  const events = new Set<string>();
  const byUser: Array<{ userId: string; update: BillingUpdate }> = [];
  const byCustomer: Array<{ customerId: string; update: BillingUpdate }> = [];
  const store: BillingStore = {
    recordEvent: async (id) => {
      if (events.has(id)) return false;
      events.add(id);
      return true;
    },
    updateByUser: async (userId, update) => void byUser.push({ userId, update }),
    updateByCustomer: async (customerId, update) => void byCustomer.push({ customerId, update }),
  };
  return { store, byUser, byCustomer };
}

const CREATED = 1_756_000_000; // an arbitrary Stripe event clock, in seconds

function event(id: string, type: string, object: Record<string, unknown>): Stripe.Event {
  return { id, type, created: CREATED, data: { object } } as unknown as Stripe.Event;
}

describe("stripe webhook processing (§8 P0 — idempotent, D11 purchases)", () => {
  it("a completed Pass checkout grants exactly 30 days from Stripe's clock", async () => {
    const { store, byUser } = memoryStore();
    const outcome = await processStripeEvent(
      store,
      event("evt_pass", "checkout.session.completed", {
        client_reference_id: "user_abc",
        customer: "cus_123",
        mode: "payment",
        payment_status: "paid",
        metadata: { product: "pass" },
      }),
    );
    expect(outcome).toEqual({ handled: true, duplicate: false });
    expect(byUser).toEqual([
      {
        userId: "user_abc",
        update: {
          // The event's own clock, not ours: a delayed webhook delivery must
          // never shorten what was paid for.
          passExpiresAt: new Date(CREATED * 1000 + PASS_DURATION_MS),
          stripeCustomerId: "cus_123",
        },
      },
    ]);
    // Critically: a Pass purchase never touches `plan` — it must not
    // accidentally grant or revoke a Guardian subscription.
    expect(byUser[0]!.update.plan).toBeUndefined();
  });

  it("a completed Guardian checkout sets the subscription plan", async () => {
    const { store, byUser } = memoryStore();
    await processStripeEvent(
      store,
      event("evt_guardian", "checkout.session.completed", {
        client_reference_id: "user_abc",
        customer: "cus_123",
        subscription: "sub_456",
        mode: "subscription",
        metadata: { product: "guardian" },
      }),
    );
    expect(byUser).toEqual([
      {
        userId: "user_abc",
        update: {
          plan: "guardian",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_456",
        },
      },
    ]);
  });

  it("is idempotent: a replayed event id is a no-op", async () => {
    const { store, byUser } = memoryStore();
    const payload = event("evt_dup", "checkout.session.completed", {
      client_reference_id: "user_abc",
      customer: "cus_123",
      mode: "payment",
      payment_status: "paid",
      metadata: { product: "pass" },
    });
    await processStripeEvent(store, payload);
    const replay = await processStripeEvent(store, payload);
    expect(replay).toEqual({ handled: false, duplicate: true });
    expect(byUser).toHaveLength(1);
  });

  it("subscription deletion ends Guardian but never touches a live Pass", async () => {
    const { store, byCustomer } = memoryStore();
    await processStripeEvent(
      store,
      event("evt_del", "customer.subscription.deleted", { customer: "cus_123" }),
    );
    expect(byCustomer).toEqual([
      { customerId: "cus_123", update: { plan: "free", stripeSubscriptionId: null } },
    ]);
    // passExpiresAt absent from the update = an unexpired Pass keeps working.
    expect(byCustomer[0]!.update.passExpiresAt).toBeUndefined();
  });

  it("tracks Guardian through subscription.updated status", async () => {
    const { store, byCustomer } = memoryStore();
    await processStripeEvent(
      store,
      event("evt_up1", "customer.subscription.updated", {
        customer: "cus_1",
        status: "active",
        metadata: { product: "guardian" },
      }),
    );
    await processStripeEvent(
      store,
      event("evt_up2", "customer.subscription.updated", { customer: "cus_1", status: "unpaid" }),
    );
    expect(byCustomer.map((entry) => entry.update.plan)).toEqual(["guardian", "free"]);
  });

  it("a legacy pre-pivot subscription checkout still grants guardian-level access", async () => {
    const { store, byUser } = memoryStore();
    await processStripeEvent(
      store,
      event("evt_legacy", "checkout.session.completed", {
        client_reference_id: "user_old",
        customer: "cus_9",
        subscription: "sub_9",
        mode: "subscription",
        metadata: { plan: "basic" }, // the old metadata shape
      }),
    );
    expect(byUser[0]!.update.plan).toBe("guardian");
  });

  it("an UNPAID completed session grants nothing — money received, not checkout finished", async () => {
    // Delayed payment methods (ACH etc.) fire "completed" with
    // payment_status "unpaid"; the payment can still fail afterwards.
    const { store, byUser } = memoryStore();
    const outcome = await processStripeEvent(
      store,
      event("evt_unpaid", "checkout.session.completed", {
        client_reference_id: "user_abc",
        customer: "cus_123",
        mode: "payment",
        payment_status: "unpaid",
        metadata: { product: "pass" },
      }),
    );
    expect(outcome).toEqual({ handled: false, duplicate: false });
    expect(byUser).toHaveLength(0);
  });

  it("async_payment_succeeded grants the Pass once the money actually moves", async () => {
    const { store, byUser } = memoryStore();
    await processStripeEvent(
      store,
      event("evt_async", "checkout.session.async_payment_succeeded", {
        client_reference_id: "user_abc",
        customer: "cus_123",
        mode: "payment",
        payment_status: "paid",
        metadata: { product: "pass" },
      }),
    );
    expect(byUser).toHaveLength(1);
    expect(byUser[0]!.update.passExpiresAt).toEqual(new Date(CREATED * 1000 + PASS_DURATION_MS));
  });

  it("a checkout with no user reference is recorded but changes nothing", async () => {
    const { store, byUser } = memoryStore();
    const outcome = await processStripeEvent(
      store,
      event("evt_anon", "checkout.session.completed", { mode: "payment" }),
    );
    expect(outcome).toEqual({ handled: false, duplicate: false });
    expect(byUser).toHaveLength(0);
  });

  it("records but does not act on unrelated event types", async () => {
    const { store, byUser, byCustomer } = memoryStore();
    const outcome = await processStripeEvent(store, event("evt_5", "invoice.finalized", {}));
    expect(outcome).toEqual({ handled: false, duplicate: false });
    expect(byUser).toHaveLength(0);
    expect(byCustomer).toHaveLength(0);
  });
});
