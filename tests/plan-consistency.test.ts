// D10 A1: the landing page and /pricing once described two different
// businesses — the landing carried pre-D5 copy promising free users the whole
// product, cancellation drafts included, which the teaser has never had.
//
// The fix is structural: plan names, prices and bullets live in
// src/lib/plans.ts and nowhere else. These tests fail the build if a surface
// starts inventing its own, so the two pages cannot drift apart again.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHEAPEST_PAID, PLANS, planById, TEASER_BOUNDARY } from "../src/lib/plans";

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
  PLANS.flatMap((plan) => [plan.monthly, plan.annual].filter(Boolean) as string[]),
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
    expect(PLANS.map((p) => p.id)).toEqual(["teaser", "basic", "pro"]);
    expect(planById("teaser").monthly).toBe("$0");
    expect(planById("teaser").annual).toBeNull();
    for (const id of ["basic", "pro"] as const) {
      expect(planById(id).monthly).toMatch(/^\$\d/);
      expect(planById(id).annual).toMatch(/^\$\d/);
    }
  });

  it("marks exactly one plan as featured", () => {
    expect(PLANS.filter((p) => p.featured)).toHaveLength(1);
  });

  it("prices marketing surfaces in USD only (D8.1)", () => {
    for (const plan of PLANS) {
      for (const price of [plan.monthly, plan.annual].filter(Boolean) as string[]) {
        expect(price, `${plan.name} is not priced in USD`).toMatch(/^\$/);
      }
    }
  });

  it("keeps the teaser's promise narrower than Basic's", () => {
    const teaser = planById("teaser").features.join(" ").toLowerCase();
    // The exact claim that drifted: free users were promised cancellation.
    expect(teaser).not.toMatch(/cancel/);
    expect(planById("basic").features.join(" ").toLowerCase()).toMatch(/cancel/);
  });

  it("quotes the cheapest paid plan in the teaser boundary line", () => {
    expect(TEASER_BOUNDARY).toContain(CHEAPEST_PAID.monthly);
    expect(CHEAPEST_PAID.id).toBe("basic");
  });
});

describe("the teaser boundary appears before the consent screen (A3)", () => {
  it("is on the landing hero and on the connect-inbox panel", () => {
    expect(source(SURFACES.landing)).toMatch(/TEASER_BOUNDARY/);
    expect(source(SURFACES.paywall)).toMatch(/TEASER_BOUNDARY/);
  });
});
