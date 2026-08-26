// The landing brief (§2) draws hard lines around what this page may claim.
// Marketing copy drifts — someone adds "save $200 a year" because it
// converts — so the lines are tests, not a note in a doc.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planById } from "../src/lib/plans";

/**
 * Comments are stripped before scanning: these rules are about what a
 * visitor reads, and the source deliberately QUOTES the banned phrasings in
 * comments to explain why they are banned. Scanning those would make the
 * documentation of a rule fail the rule.
 */
function copyOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*");
    })
    .join("\n");
}

const SOURCES = [
  "src/app/page.tsx",
  "src/app/landing-sections.tsx",
  "src/app/landing-mockups.tsx",
].map((path) => ({ path, text: copyOnly(readFileSync(path, "utf8")) }));

const all = SOURCES.map((s) => s.text).join("\n");

describe("landing copy — forbidden claims", () => {
  it("promises no savings figure, percentage, or success rate", () => {
    // "$48.96" and friends are sample dashboard data, not a savings claim;
    // what's banned is a claim ABOUT saving.
    const claims = [
      /sav(e|es|ing|ings)\s+(you\s+)?\$?\d/i,
      /\d+%\s*(of\s+)?(users|success|accuracy|savings)/i,
      /average\s+(saving|user\s+saves)/i,
      /guarantee/i,
    ];
    for (const pattern of claims) {
      expect(all, `forbidden savings/success claim: ${pattern}`).not.toMatch(pattern);
    }
  });

  it("never promises automatic or instant cancellation", () => {
    for (const pattern of [
      /cancels?\s+(them\s+)?(for\s+you|automatically)/i,
      /auto[-\s]?cancel/i,
      /instantly\s+cancel/i,
      /one[-\s]click\s+cancel/i,
    ]) {
      expect(all, `forbidden cancellation promise: ${pattern}`).not.toMatch(pattern);
    }
  });

  it("never claims we don't touch personal data — we read receipts, under a read-only grant", () => {
    for (const pattern of [
      /never\s+(see|read|touch)(es)?\s+your\s+(email|data|inbox)/i,
      /we\s+don'?t\s+(read|see|touch)\s+your\s+(email|data)/i,
      /no\s+access\s+to\s+your\s+(email|inbox)/i,
    ]) {
      expect(all, `forbidden privacy overclaim: ${pattern}`).not.toMatch(pattern);
    }
  });
});

describe("landing copy — required disclosures", () => {
  it("carries the three trust statements the brief mandates", () => {
    expect(all).toMatch(/read-only/i);
    expect(all).toMatch(/no bank connection/i);
    expect(all).toMatch(/revoke\s+(access\s+)?anytime/i);
  });

  it("states that only provider confirmation completes a cancellation", () => {
    expect(all).toMatch(/only\s+after\s+provider\s+confirmation|only\s+when\s+the\s+provider\s+confirms/i);
  });

  it("labels the mockup numbers as sample data", () => {
    expect(all).toMatch(/sample data/i);
  });

  it("uses invented merchants, never real companies", () => {
    for (const brand of ["Netflix", "Spotify", "Adobe", "Disney", "Amazon Prime", "Hulu"]) {
      expect(all, `real brand named in mockups: ${brand}`).not.toContain(brand);
    }
  });
});

describe("landing pricing matches the shipped plans (D5/D7)", () => {
  // These used to assert the literal "$4.99" appeared in the landing source.
  // Since D10 A1 the prices live in src/lib/plans.ts and the page renders
  // them from there, so a literal in this file would now be the BUG — the
  // drift the shared module exists to prevent. The check moved up a level:
  // the module carries the real prices, and the page reads the module
  // (enforced by tests/plan-consistency.test.ts).
  it("carries the real D7 prices in the shared module", () => {
    expect(planById("basic").monthly).toBe("$4.99");
    expect(planById("basic").annual).toBe("$49");
    expect(planById("pro").monthly).toBe("$9.99");
    expect(planById("pro").annual).toBe("$99");
  });

  it("renders its pricing strip from the module rather than its own copy", () => {
    const landing = readFileSync("src/app/landing-sections.tsx", "utf8");
    expect(landing).toMatch(/PLANS\.map/);
  });
});
