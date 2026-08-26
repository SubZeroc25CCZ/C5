// Unit adapter between storage and the engine. The DB stores integer minor
// units (cents); the ported v1 engine (src/engine/normalize.ts — the ONE
// money calculator) works in major units. All conversion happens here.

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

function divisor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

export function majorToMinor(amount: number, currency: string): number {
  return Math.round(amount * divisor(currency));
}

export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / divisor(currency);
}

/** "1199" + "EUR" → "€11.99" */
export function formatMinor(amountMinor: number, currency: string): string {
  const code = currency.toUpperCase();
  const value = minorToMajor(amountMinor, code);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}
