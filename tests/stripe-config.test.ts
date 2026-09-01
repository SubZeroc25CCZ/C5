// A key/price mode mismatch once produced a bare 500 in production and a
// "please try again" that could never succeed. These tests pin the guards
// that turn that class of misconfiguration into a message naming the
// variable to set. Since D11 the DEFAULTS are the LIVE price ids (so a
// fresh production deployment needs no price env at all) and it is the
// TEST-mode key that must bring its own prices.

import { afterEach, describe, expect, it } from "vitest";
import { priceId, stripeClient } from "../src/services/stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
const ENV_KEYS = ["STRIPE_PRICE_PASS", "STRIPE_PRICE_GUARDIAN"] as const;
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
  it("defaults to the live prices under a live key — no env required", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    for (const key of ENV_KEYS) delete process.env[key];
    expect(priceId("pass")).toBe("price_1UAnF0G8giGg4s7RCHCAQgO3");
    expect(priceId("guardian")).toBe("price_1UAnF6G8giGg4s7RnhQhGXLy");
  });

  it("refuses the live defaults under a test key, naming the variable", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    for (const key of ENV_KEYS) delete process.env[key];
    expect(() => priceId("pass")).toThrow(/STRIPE_PRICE_PASS/);
    expect(() => priceId("guardian")).toThrow(/STRIPE_PRICE_GUARDIAN/);
  });

  it("prefers a configured price over the default, in either mode", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    process.env.STRIPE_PRICE_PASS = "price_experiment_a";
    expect(priceId("pass")).toBe("price_experiment_a");
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.STRIPE_PRICE_GUARDIAN = "price_test_guardian";
    expect(priceId("guardian")).toBe("price_test_guardian");
  });

  it("treats a missing key as test mode: fail toward the explicit error", () => {
    delete process.env.STRIPE_SECRET_KEY;
    for (const key of ENV_KEYS) delete process.env[key];
    // No key + no prices must not silently point at LIVE prices — the
    // missing-key case is reported by requireStripeKey() at call time, and
    // this path reports the missing price variable.
    expect(() => priceId("pass")).toThrow(/STRIPE_PRICE_PASS/);
  });
});

describe("stripeClient", () => {
  // The first version of this guard lived inside createCheckoutSession, which
  // never ran: every caller builds the client first, so the SDK constructor
  // threw "Neither apiKey nor config.authenticator provided" and the log
  // never named STRIPE_SECRET_KEY. The guard has to be on the constructor.
  it("names STRIPE_SECRET_KEY when the key is missing", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => stripeClient()).toThrow(/STRIPE_SECRET_KEY is not set/);
  });

  it("names STRIPE_SECRET_KEY when the key is empty rather than absent", () => {
    process.env.STRIPE_SECRET_KEY = "";
    expect(() => stripeClient()).toThrow(/STRIPE_SECRET_KEY is not set/);
  });

  it("constructs a client when the key is present", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    expect(() => stripeClient()).not.toThrow();
  });
});
