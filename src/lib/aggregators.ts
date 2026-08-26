// Aggregator merchants (decision D6): storefronts that bill many services
// on one receipt — Apple, Google, PayPal, Amazon, Microsoft. A charge from
// them is real spend but NOT a single subscription: amounts vary because the
// basket varies. They render as a "storefront charges" group (observed spend,
// no monthly claim) and their receipts get line-item extraction so each
// underlying service can build real recurrence.

const AGGREGATOR_KEYS = new Set([
  "apple",
  "apple-services",
  "google",
  "google-play",
  "google-services",
  "paypal",
  "amazon",
  "amazon-marketplace",
  "microsoft",
  "microsoft-store",
]);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Whether a merchant name/slug is a storefront aggregator. Deliberately an
 * exact match on the normalized name: "Apple" and "Apple Services" are
 * aggregators; "Apple TV+", "Amazon Prime", "Microsoft 365", "Google One"
 * are real single-service subscriptions and stay untouched.
 */
export function isAggregatorMerchant(nameOrSlug: string): boolean {
  return AGGREGATOR_KEYS.has(normalize(nameOrSlug));
}

export const AGGREGATOR_EXPLAINER =
  "This storefront bills many services together — amounts vary by receipt, so we show observed spend instead of a monthly price.";
