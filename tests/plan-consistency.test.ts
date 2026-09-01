// D10 A1: the landing page and /pricing once described two different
// businesses — the landing carried pre-D5 copy promising free users the whole
// product, cancellation drafts included, which the teaser has never had.
//
// The fix is structural: plan names, prices and bullets live in
// src/lib/plans.ts and nowhere else. These tests fail the build if a surface
// starts inventing its own, so the two pages cannot drift apart again.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PASS, PLANS, planById, TEASER_BOUNDARY } from "../src/lib/plans";

const SURFACES = {
  landing: "src/app/landing-sections.tsx",
  pricing: "src/app/pricing/pricing-client.tsx",
  paywall: "src/app/dashboard/dashboard-client.tsx",
} as const;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

/** Prices that are plan prices, not sample subscription amounts in mockups. */
const PLAN_PRICES = new Set(
  PLANS.map((plan) => plan.price).filter((price) => price !== "$0"),
);

describe("plan copy has exactly one home", () => {
  it.each(Object.entries(SURFACES))(
    "%s imports plans.ts rather than hardcoding a plan price",
    (_name, path) => {
      const text = source(path);
      expect(text, `${path} should read plan data from @/lib/plans`).toMatch(
        /from "@\/lib\/plans"/,
      );
    },
  );

  it.each(Object.entries(SURFACES))(
    "%s contains no literal plan price string",
    (_name, path) => {
      // Strip comments: they may quote a price while explaining the rule.
      const text = source(path)
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .split("\n")
        .filter((line) => {
          const t = line.trim();
          return !t.startsWith("//") && !t.startsWith("*");
        })
        .join("\n");

      for (const price of PLAN_PRICES) {
        const escaped = price.replace(/[$.]/g, (c) => `\\${c}`);
        expect(
          text,
          `${path} hardcodes ${price}; import it from @/lib/plans instead`,
        ).not.toMatch(new RegExp(`["'\`>\\s]${escaped}(?![\\d])`));
      }
    },
  );
});

describe("the plan data itself is coherent", () => {
  it("names the three shipped tiers, in order, with the paid two priced", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "pass", "guardian"]);
    expect(planById("free").price).toBe("$0");
    expect(planById("free").cadence).toBeNull();
    for (const id of ["pass", "guardian"] as const) {
      expect(planById(id).price).toMatch(/^\$\d/);
      expect(planById(id).cadence).toBeTruthy();
    }
  });

  it("the Pass is one-time and Guardian is annual — the pivot's whole point (D11)", () => {
    expect(planById("pass").cadence).toBe("one-time");
    expect(planById("guardian").cadence).toBe("per year");
    // A monthly cadence reappearing anywhere is the irony coming back.
    for (const plan of PLANS) {
      expect(plan.cadence ?? "", `${plan.name} is priced monthly`).not.toMatch(/month/i);
      expect(plan.tagline, `${plan.name} tagline mentions monthly`).not.toMatch(/\/month/i);
    }
  });

  it("marks exactly one plan as featured", () => {
    expect(PLANS.filter((p) => p.featured)).toHaveLength(1);
  });

  it("prices marketing surfaces in USD only (D8.1)", () => {
    for (const plan of PLANS) {
      expect(plan.price, `${plan.name} is not priced in USD`).toMatch(/^\$/);
    }
  });

  it("keeps the free tier's promise narrower than the Pass's", () => {
    const free = planById("free").features.join(" ").toLowerCase();
    // The exact claim that drifted once: free users promised cancellation.
    expect(free).not.toMatch(/cancel/);
    expect(planById("pass").features.join(" ").toLowerCase()).toMatch(/cancel/);
  });

  it("quotes the Pass in the free-tier boundary line, as a one-time price", () => {
    expect(TEASER_BOUNDARY).toContain(PASS.price);
    expect(TEASER_BOUNDARY.toLowerCase()).toMatch(/one payment|one-time/);
    expect(PASS.id).toBe("pass");
  });
});

describe("the teaser boundary appears before the consent screen (A3)", () => {
  it("is on the landing hero and on the connect-inbox panel", () => {
    expect(source(SURFACES.landing)).toMatch(/TEASER_BOUNDARY/);
    expect(source(SURFACES.paywall)).toMatch(/TEASER_BOUNDARY/);
  });
});
