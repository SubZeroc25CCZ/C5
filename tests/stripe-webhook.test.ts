import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  processStripeEvent,
  type BillingStore,
  type PlanUpdate,
} from "../src/services/stripe";

function memoryStore() {
  const events = new Set<string>();
  const byUser: Array<{ userId: string; update: PlanUpdate }> = [];
  const byCustomer: Array<{ customerId: string; update: PlanUpdate }> = [];
  const store: BillingStore = {
    recordEvent: async (id) => {
      if (events.has(id)) return false;
      events.add(id);
      return true;
    },
    setPlanByUser: async (userId, update) => void byUser.push({ userId, update }),
    setPlanByCustomer: async (customerId, update) => void byCustomer.push({ customerId, update }),
  };
  return { store, byUser, byCustomer };
}

function event(id: string, type: string, object: Record<string, unknown>): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

describe("stripe webhook processing (§8 P0 — idempotent)", () => {
  it("upgrades the user on checkout.session.completed", async () => {
    const { store, byUser } = memoryStore();
    const outcome = await processStripeEvent(
      store,
      event("evt_1", "checkout.session.completed", {
        client_reference_id: "user_abc",
        customer: "cus_123",
        subscription: "sub_456",
        metadata: { plan: "basic" },
      }),
    );
    expect(outcome).toEqual({ handled: true, duplicate: false });
    expect(byUser).toEqual([
      {
        userId: "user_abc",
        update: { plan: "basic", stripeCustomerId: "cus_123", stripeSubscriptionId: "sub_456" },
      },
    ]);
  });

  it("is idempotent: a replayed event id is a no-op", async () => {
    const { store, byUser } = memoryStore();
    const payload = event("evt_dup", "checkout.session.completed", {
      client_reference_id: "user_abc",
      customer: "cus_123",
      subscription: "sub_456",
    });
    await processStripeEvent(store, payload);
    const replay = await processStripeEvent(store, payload);
    expect(replay).toEqual({ handled: false, duplicate: true });
    expect(byUser).toHaveLength(1);
  });

  it("downgrades on subscription deletion", async () => {
    const { store, byCustomer } = memoryStore();
    await processStripeEvent(
      store,
      event("evt_2", "customer.subscription.deleted", { customer: "cus_123" }),
    );
    expect(byCustomer).toEqual([
      { customerId: "cus_123", update: { plan: "teaser", stripeSubscriptionId: null } },
    ]);
  });

  it("tracks plan through subscription.updated status", async () => {
    const { store, byCustomer } = memoryStore();
    await processStripeEvent(
      store,
      event("evt_3", "customer.subscription.updated", {
        customer: "cus_1",
        status: "active",
        metadata: { plan: "pro" },
      }),
    );
    await processStripeEvent(
      store,
      event("evt_4", "customer.subscription.updated", { customer: "cus_1", status: "unpaid" }),
    );
    expect(byCustomer.map((entry) => entry.update.plan)).toEqual(["pro", "teaser"]);
  });

  it("legacy checkout events without plan metadata default to pro", async () => {
    const { store, byUser } = memoryStore();
    await processStripeEvent(
      store,
      event("evt_legacy", "checkout.session.completed", {
        client_reference_id: "user_old",
        customer: "cus_9",
        subscription: "sub_9",
      }),
    );
    expect(byUser[0]!.update.plan).toBe("pro");
  });

  it("records but does not act on unrelated event types", async () => {
    const { store, byUser, byCustomer } = memoryStore();
    const outcome = await processStripeEvent(store, event("evt_5", "invoice.finalized", {}));
    expect(outcome).toEqual({ handled: false, duplicate: false });
    expect(byUser).toHaveLength(0);
    expect(byCustomer).toHaveLength(0);
  });
});
