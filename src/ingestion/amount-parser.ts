// Deterministic amount/currency extraction used on Stage 1 matches before
// falling back to the LLM: a receipt from a known merchant usually states
// the charge in a handful of predictable formats.

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "£": "GBP",
  "$": "USD",
  "₪": "ILS",
  "฿": "THB",
  "₱": "PHP",
  "¥": "JPY",
  "₹": "INR",
  "zł": "PLN",
  "kr": "SEK",
};

const CODE_PATTERN = "(USD|EUR|GBP|ILS|THB|PHP|JPY|INR|AUD|CAD|NZD|SGD|HKD|CHF|SEK|NOK|DKK|PLN|CZK|BRL|MXN)";
const NUM = String.raw`(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;

export interface ParsedAmount {
  amountMinor: number;
  currency: string;
}

function toMinor(numText: string, currency: string): number | null {
  let normalized = numText.replace(/\s/g, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma > lastDot) {
    // 1.234,56 → comma is the decimal separator
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  const zeroDecimal = currency === "JPY";
  return Math.round(value * (zeroDecimal ? 1 : 100));
}

/**
 * Find the most likely charge amount in an email body. Symbol- or
 * code-adjacent amounts only; if nothing parses, the message goes to
 * Stage 2 instead of guessing.
 */
export function parseAmount(text: string): ParsedAmount | null {
  const candidates: ParsedAmount[] = [];

  // "€11.99", "$ 4.99", "₪29.90"
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}\\s?${NUM}`, "g");
    for (const match of text.matchAll(re)) {
      const minor = toMinor(match[1]!, code);
      if (minor !== null) candidates.push({ amountMinor: minor, currency: code });
    }
  }

  // "11.99 EUR", "EUR 11.99", "USD11.99"
  const codeAfter = new RegExp(`${NUM}\\s?${CODE_PATTERN}\\b`, "g");
  const codeBefore = new RegExp(`\\b${CODE_PATTERN}\\s?${NUM}`, "g");
  for (const match of text.matchAll(codeAfter)) {
    const minor = toMinor(match[1]!, match[2]!);
    if (minor !== null) candidates.push({ amountMinor: minor, currency: match[2]! });
  }
  for (const match of text.matchAll(codeBefore)) {
    const minor = toMinor(match[2]!, match[1]!);
    if (minor !== null) candidates.push({ amountMinor: minor, currency: match[1]! });
  }

  if (candidates.length === 0) return null;
  // Receipts often repeat the charge (line item + total). The largest
  // symbol-tagged amount is the total more often than not.
  candidates.sort((a, b) => b.amountMinor - a.amountMinor);
  return candidates[0]!;
}
