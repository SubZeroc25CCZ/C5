import { describe, expect, it } from "vitest";
import { parseAmount } from "../src/ingestion/amount-parser";

describe("amount parser (Stage 1 deterministic extraction)", () => {
  it("parses symbol-prefixed amounts", () => {
    expect(parseAmount("You were charged €11.99 for Netflix")).toEqual({
      amountMinor: 1199,
      currency: "EUR",
    });
    expect(parseAmount("Total: $4.99")).toEqual({ amountMinor: 499, currency: "USD" });
    expect(parseAmount("סכום החיוב: ₪29.90")).toEqual({ amountMinor: 2990, currency: "ILS" });
    expect(parseAmount("ยอดชำระ ฿199")).toEqual({ amountMinor: 19900, currency: "THB" });
  });

  it("parses ISO-code amounts in both orders", () => {
    expect(parseAmount("Amount: 12.99 EUR")).toEqual({ amountMinor: 1299, currency: "EUR" });
    expect(parseAmount("USD 9.99 charged to your card")).toEqual({
      amountMinor: 999,
      currency: "USD",
    });
  });

  it("handles European decimal commas and thousands separators", () => {
    expect(parseAmount("Betrag: €1.234,56")).toEqual({ amountMinor: 123456, currency: "EUR" });
    expect(parseAmount("Total $1,234.56")).toEqual({ amountMinor: 123456, currency: "USD" });
  });

  it("treats JPY as zero-decimal", () => {
    expect(parseAmount("料金 ¥1500")).toEqual({ amountMinor: 1500, currency: "JPY" });
  });

  it("picks the largest amount when a receipt repeats line items and total", () => {
    expect(parseAmount("Plan €9.99, VAT €2.00, Total €11.99")).toEqual({
      amountMinor: 1199,
      currency: "EUR",
    });
  });

  it("returns null when no currency-tagged amount is present", () => {
    expect(parseAmount("Thanks for being a subscriber since 2019!")).toBeNull();
    expect(parseAmount("Your order number is 123456")).toBeNull();
  });
});
