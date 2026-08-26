import { describe, expect, it } from "vitest";
import { formatMinor, majorToMinor, minorToMajor } from "../src/lib/money";
import { portfolioTotalsByCurrency } from "../src/engine/normalize";

describe("money unit adapter", () => {
  it("round-trips major/minor units", () => {
    expect(majorToMinor(11.99, "EUR")).toBe(1199);
    expect(minorToMajor(1199, "EUR")).toBeCloseTo(11.99);
    expect(majorToMinor(1500, "JPY")).toBe(1500);
    expect(minorToMajor(1500, "JPY")).toBe(1500);
  });

  it("formats for display", () => {
    expect(formatMinor(1199, "EUR")).toBe("€11.99");
    expect(formatMinor(1500, "JPY")).toBe("¥1,500");
  });
});

describe("multi-currency portfolio totals (§ Goals 4, §10.1 — no synthetic FX)", () => {
  it("keeps currencies in separate buckets", () => {
    const totals = portfolioTotalsByCurrency([
      { amount: 11.99, cycle: "monthly", status: "active", currency: "EUR", category: "streaming" },
      { amount: 120, cycle: "yearly", status: "active", currency: "EUR", category: "software" },
      { amount: 9.99, cycle: "monthly", status: "active", currency: "USD" },
      { amount: 99, cycle: "monthly", status: "cancelled", currency: "USD" },
    ]);
    expect(totals).toHaveLength(2);
    const eur = totals.find((total) => total.currency === "EUR")!;
    const usd = totals.find((total) => total.currency === "USD")!;
    expect(eur.monthly).toBeCloseTo(21.99);
    expect(eur.yearly).toBeCloseTo(263.88);
    expect(eur.byCategory).toEqual({ streaming: 11.99, software: 10 });
    expect(usd.monthly).toBeCloseTo(9.99);
    expect(usd.activeCount).toBe(1);
  });

  it("returns an empty list for no subscriptions — an empty state is a correct answer", () => {
    expect(portfolioTotalsByCurrency([])).toEqual([]);
  });
});
