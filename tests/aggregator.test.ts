// D6 regression: the varying-amount Apple pattern. A storefront receipt
// carries several services; the aggregate "Apple" charge stream has no
// stable amount, so it must never masquerade as one subscription — and with
// line-item extraction each service builds its own real recurrence.

import { describe, expect, it } from "vitest";
import { isAggregatorMerchant } from "../src/lib/aggregators";
import { parseExtraction } from "../src/engine/extraction";
import { detectSubscriptions } from "../src/engine/recurrence";
import { processBatch, processCandidate } from "../src/ingestion/pipeline";
import { MerchantMatcher } from "../src/ingestion/stage1-matcher";
import type { EmailCandidate, MerchantRecord, PersistableCharge } from "../src/ingestion/types";
import type { ExtractionModel } from "../src/ingestion/stage2-extractor";

const apple: MerchantRecord = {
  id: 7,
  name: "Apple",
  slug: "apple",
  domains: ["apple.com"],
  category: "storefront",
  cancelUrl: "https://apps.apple.com/account/subscriptions",
  cancelMethod: "url",
  difficulty: 2,
};

const silentLogger = { info: () => {}, warn: () => {} };

function appleReceipt(id: string, receivedAt: Date): EmailCandidate {
  return {
    messageId: id,
    from: "Apple <no_reply@email.apple.com>",
    subject: "Your receipt from Apple",
    receivedAt,
    body: "Total €12.98 — iCloud+ €2.99, Apple Music €9.99",
  };
}

/** Model that returns the same two line items on every receipt. */
const itemsModel: ExtractionModel = {
  complete: async () =>
    JSON.stringify({
      merchant: "Apple",
      amount: 12.98,
      currency: "EUR",
      chargedAt: "2026-08-01",
      cycleHint: "unknown",
      confidence: 0.95,
      items: [
        { name: "iCloud+", amount: 2.99 },
        { name: "Apple Music", amount: 9.99 },
      ],
    }),
};

describe("aggregator merchant matching (D6)", () => {
  it("flags storefronts and only storefronts", () => {
    for (const name of ["Apple", "Apple Services", "Google", "Google Play", "PayPal", "Amazon", "Microsoft"]) {
      expect(isAggregatorMerchant(name), name).toBe(true);
    }
    for (const name of ["Apple TV+", "Amazon Prime", "Amazon Web Services", "Microsoft 365", "Google One", "YouTube Premium", "Netflix"]) {
      expect(isAggregatorMerchant(name), name).toBe(false);
    }
  });
});

describe("extraction items[] (D6)", () => {
  it("parses line items and defaults to an empty array", () => {
    const withItems = parseExtraction(
      '{"merchant":"Apple","amount":12.98,"currency":"EUR","chargedAt":"2026-08-01","cycleHint":"unknown","confidence":0.9,"items":[{"name":"iCloud+","amount":2.99}]}',
    );
    expect(withItems?.items).toEqual([{ name: "iCloud+", amount: 2.99 }]);
    const without = parseExtraction(
      '{"merchant":"Gym","amount":20,"currency":"EUR","chargedAt":"2026-08-01","cycleHint":"monthly","confidence":0.9}',
    );
    expect(without?.items).toEqual([]);
  });
});

describe("aggregator receipts split into per-service charges (D6)", () => {
  it("routes aggregators past Stage 1 and saves one charge per line item", async () => {
    const persisted: PersistableCharge[] = [];
    const saved = await processCandidate(appleReceipt("msg-apple-1", new Date("2026-08-01T10:00:00Z")), {
      matcher: new MerchantMatcher([apple]),
      model: itemsModel,
      sink: { save: async (charge) => void persisted.push(charge) },
      logger: silentLogger,
    });

    expect(saved).toHaveLength(2);
    expect(persisted.map((c) => c.merchantName).sort()).toEqual(["Apple Music", "iCloud+"]);
    // Refs stay unique per (userId, sourceMessageRef) and traceable to the email.
    expect(persisted.map((c) => c.messageId).sort()).toEqual(["msg-apple-1#0", "msg-apple-1#1"]);
    expect(persisted.find((c) => c.merchantName === "iCloud+")?.amountMinor).toBe(299);
    // The aggregator merchant link is kept for logo + cancellation playbook.
    expect(persisted.every((c) => c.merchantId === apple.id)).toBe(true);
  });

  it("regression: three monthly Apple receipts become per-service confirmed subscriptions, never a varying 'Apple' one", async () => {
    const persisted: PersistableCharge[] = [];
    await processBatch(
      [
        appleReceipt("m1", new Date("2026-06-01T10:00:00Z")),
        appleReceipt("m2", new Date("2026-07-01T10:00:00Z")),
        appleReceipt("m3", new Date("2026-08-01T10:00:00Z")),
      ],
      {
        matcher: new MerchantMatcher([apple]),
        model: itemsModel,
        sink: { save: async (charge) => void persisted.push(charge) },
        logger: silentLogger,
      },
    );
    // NOTE: the mock model returns a fixed chargedAt; recurrence needs the
    // real receipt dates, so feed the engine the received dates directly.
    const engineCharges = persisted.map((c, i) => ({
      merchant: c.merchantName,
      amount: c.amountMinor / 100,
      currency: c.currency,
      chargedAt: new Date(`2026-0${6 + Math.floor(i / 2)}-01T10:00:00Z`),
    }));

    const { confirmed, possible } = detectSubscriptions(engineCharges);
    expect(confirmed.map((sub) => sub.merchant).sort()).toEqual(["Apple Music", "iCloud+"]);
    expect(confirmed.every((sub) => sub.cycle === "monthly")).toBe(true);
    // No aggregate "Apple" subscription, and no price-change noise: each
    // service has a stable price.
    expect(confirmed.every((sub) => sub.priceChanges.length === 0)).toBe(true);
    expect(possible).toHaveLength(0);
  });
});
