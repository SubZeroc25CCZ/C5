import { describe, expect, it } from "vitest";
import { redactListForTeaser, unlockedSubscriptionId } from "@/services/redaction";

function row(
  id: number,
  name: string,
  amountMinor: number,
  currency = "EUR",
  status = "active",
  cycle = "monthly",
) {
  return {
    subscription: { id, name, status, amountMinor, currency, cycle },
    merchant: { name, domains: [`${name.toLowerCase()}.example`] },
  };
}

const FULL = {
  subscriptions: [
    row(1, "CheapFlix", 499),
    row(2, "MegaCloud", 2400),
    row(3, "MidStream", 1299),
    row(4, "MaybeSub", 999, "EUR", "possible"),
    row(5, "DollarThing", 999_00, "USD"), // expensive but not the dominant currency
  ],
  totals: [
    { currency: "EUR", monthlyTotal: 41.98 },
    { currency: "USD", monthlyTotal: 9.99 },
  ],
  recentPriceChanges: [
    { subscriptionId: 2, oldAmountMinor: 1999, newAmountMinor: 2400 },
    { subscriptionId: 1, oldAmountMinor: 399, newAmountMinor: 499 },
  ],
};

describe("unlockedSubscriptionId", () => {
  it("picks the top sub of the currency with the highest confirmed total", () => {
    // USD's single $999 sub outweighs EUR's combined total, so it unlocks.
    expect(unlockedSubscriptionId(FULL.subscriptions)).toBe(5);
  });

  it("within the dominant currency, the highest normalized monthly wins", () => {
    expect(
      unlockedSubscriptionId([
        row(1, "CheapFlix", 499),
        row(2, "MegaCloud", 2400),
        row(3, "MidStream", 1299),
      ]),
    ).toBe(2);
  });

  it("ignores possible sightings and returns null with no confirmed subs", () => {
    expect(unlockedSubscriptionId([row(9, "OnlySeen", 5000, "EUR", "possible")])).toBeNull();
  });
});

describe("redactListForTeaser", () => {
  const redacted = redactListForTeaser(FULL);

  it("keeps totals and counts", () => {
    expect(redacted.totals).toEqual(FULL.totals);
    expect(redacted.counts).toEqual({ total: 5, confirmed: 4, possible: 1 });
  });

  it("exposes exactly one unlocked subscription in full", () => {
    expect(redacted.unlocked?.subscription.id).toBe(5);
    expect(redacted.unlocked?.subscription.name).toBe("DollarThing");
    expect(redacted.lockedRows).toHaveLength(4);
  });

  it("locked rows carry status only — no merchant, amount, or id", () => {
    for (const locked of redacted.lockedRows) {
      expect(Object.keys(locked).sort()).toEqual(["locked", "status"]);
    }
  });

  it("price changes are limited to the unlocked subscription", () => {
    // Both recorded changes concern locked subs — none may leave the server.
    expect(redacted.recentPriceChanges).toEqual([]);
  });

  it("NOTHING about locked subscriptions survives serialization", () => {
    // The wire-format guarantee: what the client receives simply does not
    // contain the locked merchants' names, domains, amounts, or ids.
    const wire = JSON.stringify(redacted);
    for (const name of ["CheapFlix", "MegaCloud", "MidStream", "MaybeSub"]) {
      expect(wire).not.toContain(name);
      expect(wire.toLowerCase()).not.toContain(name.toLowerCase());
    }
    expect(wire).not.toContain("499"); // CheapFlix amount + its price change
    expect(wire).not.toContain("1299"); // MidStream amount
    expect(wire).not.toContain("2400"); // MegaCloud amount + its price change
    expect(wire).toContain("DollarThing"); // …while the unlocked sub is intact
  });

  it("handles an empty scan result", () => {
    const empty = redactListForTeaser({ subscriptions: [], totals: [], recentPriceChanges: [] });
    expect(empty.unlocked).toBeNull();
    expect(empty.lockedRows).toEqual([]);
    expect(empty.counts.total).toBe(0);
  });
});
