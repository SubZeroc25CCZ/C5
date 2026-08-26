// A live Stripe key with the built-in test-mode price ids produced a bare
// 500 in production and a "please try again" that could never succeed. These
// tests pin the guard that turns that class of misconfiguration into a
// message naming the variable to set.

import { afterEach, describe, expect, it } from "vitest";
import { priceId } from "../src/services/stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
const ENV_KEYS = [
  "STRIPE_PRICE_BASIC_MONTHLY",
  "STRIPE_PRICE_BASIC_ANNUAL",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  if (KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = KEY;
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key]!;
  }
});

describe("priceId", () => {
  it("falls back to the test-mode price under a test key", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    for (const key of ENV_KEYS) delete process.env[key];
    expect(priceId("basic", "monthly")).toBe("price_1U8aR2G8giGg4s7R5Dgx1OdI");
    expect(priceId("pro", "annual")).toBe("price_1U8aR7G8giGg4s7RWeeNlkh3");
  });

  it("refuses the test-mode fallback under a live key, naming the variable", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    for (const key of ENV_KEYS) delete process.env[key];
    expect(() => priceId("basic", "monthly")).toThrow(/STRIPE_PRICE_BASIC_MONTHLY/);
    expect(() => priceId("pro", "annual")).toThrow(/STRIPE_PRICE_PRO_ANNUAL/);
  });

  it("uses the configured live price when one is set", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_live_pro_monthly";
    expect(priceId("pro", "monthly")).toBe("price_live_pro_monthly");
  });

  it("prefers the configured price over the fallback in test mode too", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.STRIPE_PRICE_BASIC_ANNUAL = "price_custom_basic_annual";
    expect(priceId("basic", "annual")).toBe("price_custom_basic_annual");
  });

  it("treats a missing key as test mode rather than failing closed on price lookup", () => {
    delete process.env.STRIPE_SECRET_KEY;
    for (const key of ENV_KEYS) delete process.env[key];
    // The missing-key case is reported by requireStripeKey() at call time,
    // with its own message; priceId must not pre-empt it with a confusing one.
    expect(priceId("basic", "monthly")).toBe("price_1U8aR2G8giGg4s7R5Dgx1OdI");
  });
});
