// §4.6 is a product law, not a UI preference: an unverified cancel URL never
// renders to a customer. A guessed cancellation link is worse than no link —
// the user follows it, believes they cancelled, and keeps being charged.
// These tests hold the single chokepoint every customer-facing router uses.

import { describe, expect, it } from "vitest";
import { customerMerchant } from "../src/server/merchant-view";

const base = {
  id: 1,
  name: "Stream Plus",
  cancelUrl: "https://streamplus.example/account/cancel",
  cancelEmail: "support@streamplus.example",
  cancelMethod: "url" as const,
  difficulty: 2,
  cancelUrlVerifiedAt: null as Date | null,
  cancelUrlVerifiedBy: null as string | null,
  cancelUrlSource: null as string | null,
};

describe("customerMerchant", () => {
  it("strips a cancel URL that carries no verification", () => {
    const view = customerMerchant(base);
    expect(view.cancelUrl).toBeNull();
    expect(view.cancelUrlVerified).toBe(false);
  });

  it("passes a verified cancel URL through", () => {
    const view = customerMerchant({
      ...base,
      cancelUrlVerifiedAt: new Date("2026-08-01"),
      cancelUrlVerifiedBy: "user_admin",
      cancelUrlSource: "Confirmed on the merchant's help centre.",
    });
    expect(view.cancelUrl).toBe("https://streamplus.example/account/cancel");
    expect(view.cancelUrlVerified).toBe(true);
  });

  it("never leaks who verified it, or against what — that is admin data", () => {
    const view = customerMerchant({
      ...base,
      cancelUrlVerifiedAt: new Date("2026-08-01"),
      cancelUrlVerifiedBy: "user_admin",
      cancelUrlSource: "Internal research note",
    });
    expect(Object.keys(view)).not.toContain("cancelUrlVerifiedBy");
    expect(Object.keys(view)).not.toContain("cancelUrlSource");
    expect(JSON.stringify(view)).not.toContain("user_admin");
    expect(JSON.stringify(view)).not.toContain("Internal research note");
  });

  it("keeps the rest of the merchant intact — this strips, it does not filter", () => {
    const view = customerMerchant(base);
    expect(view.name).toBe("Stream Plus");
    expect(view.cancelEmail).toBe("support@streamplus.example");
    expect(view.difficulty).toBe(2);
  });

  it("passes null through for a subscription with no matched merchant", () => {
    expect(customerMerchant(null)).toBeNull();
  });
});
