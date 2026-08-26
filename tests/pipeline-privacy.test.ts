// §8 P0: "Process-and-discard pipeline verified by test: no raw body ever
// written to DB or logs." Sentinel strings are planted in email bodies; the
// test asserts they appear nowhere in what the pipeline persists or logs —
// on the Stage 1 path, the Stage 2 path, and the discard path.

import { describe, expect, it } from "vitest";
import { processBatch, type PipelineLogger } from "../src/ingestion/pipeline";
import { MerchantMatcher } from "../src/ingestion/stage1-matcher";
import type { EmailCandidate, MerchantRecord, PersistableCharge } from "../src/ingestion/types";
import type { ExtractionModel } from "../src/ingestion/stage2-extractor";

const SENTINEL_1 = "TOP-SECRET-BODY-ALPHA-9f8e7d";
const SENTINEL_2 = "TOP-SECRET-BODY-BRAVO-1a2b3c";
const SENTINEL_3 = "TOP-SECRET-BODY-CHARLIE-4d5e6f";

const netflix: MerchantRecord = {
  id: 1,
  name: "Netflix",
  slug: "netflix",
  domains: ["netflix.com"],
  category: "streaming",
  cancelUrl: null,
  cancelMethod: "url",
  difficulty: 1,
};

const candidates: EmailCandidate[] = [
  {
    // Stage 1 path: known merchant, parseable amount
    messageId: "msg-1",
    from: "Netflix <info@account.netflix.com>",
    subject: "Your Netflix receipt",
    receivedAt: new Date("2026-08-01T10:00:00Z"),
    body: `Thanks for your payment of €11.99. ${SENTINEL_1}`,
  },
  {
    // Stage 2 path: unknown merchant, model extracts
    messageId: "msg-2",
    from: "Mystery Gym <billing@mysterygym.example>",
    subject: "Payment confirmation",
    receivedAt: new Date("2026-08-02T10:00:00Z"),
    body: `Your membership renewal. ${SENTINEL_2}`,
  },
  {
    // Discard path: model says it is not a billing email
    messageId: "msg-3",
    from: "Newsletter <hello@spam.example>",
    subject: "Weekly digest",
    receivedAt: new Date("2026-08-03T10:00:00Z"),
    body: `Nothing to bill here. ${SENTINEL_3}`,
  },
];

function containsSentinel(text: string): boolean {
  return [SENTINEL_1, SENTINEL_2, SENTINEL_3].some((sentinel) => text.includes(sentinel));
}

describe("process-and-discard privacy guarantee", () => {
  it("never lets raw body content reach the sink or the logs", async () => {
    const persisted: PersistableCharge[] = [];
    const logLines: string[] = [];

    const logger: PipelineLogger = {
      info: (message, fields) => logLines.push(JSON.stringify({ message, ...fields })),
      warn: (message, fields) => logLines.push(JSON.stringify({ message, ...fields })),
    };

    const model: ExtractionModel = {
      // The model sees the body (that is its job) but its structured reply
      // is the only thing that continues downstream.
      complete: async ({ subject }) =>
        subject === "Payment confirmation"
          ? JSON.stringify({
              merchant: "Mystery Gym",
              amount: 29.9,
              currency: "EUR",
              chargedAt: "2026-08-02",
              cycleHint: "monthly",
              confidence: 0.9,
            })
          : "null",
    };

    const stats = await processBatch(candidates, {
      matcher: new MerchantMatcher([netflix]),
      model,
      logger,
      sink: { save: async (charge) => void persisted.push(charge) },
    });

    expect(stats).toEqual({
      processed: 3,
      stage1Hits: 1,
      stage2Hits: 1,
      needsReview: 0,
      discarded: 1,
    });

    // Nothing persisted carries any body content — not in any field.
    const persistedSerialized = JSON.stringify(persisted);
    expect(containsSentinel(persistedSerialized)).toBe(false);
    // The persisted shape has no body-like field at all.
    for (const charge of persisted) {
      expect(Object.keys(charge)).not.toContain("body");
    }

    // Nothing logged carries any body content.
    expect(containsSentinel(logLines.join("\n"))).toBe(false);
  });

  it("keeps only the allowed fields: merchant, amount, currency, date, cycle, message ref, subject", async () => {
    const persisted: PersistableCharge[] = [];
    await processBatch([candidates[0]!], {
      matcher: new MerchantMatcher([netflix]),
      model: { complete: async () => "null" },
      logger: { info: () => {}, warn: () => {} },
      sink: { save: async (charge) => void persisted.push(charge) },
    });
    expect(persisted).toHaveLength(1);
    expect(new Set(Object.keys(persisted[0]!))).toEqual(
      new Set([
        "messageId",
        "merchantName",
        "merchantId",
        "amountMinor",
        "currency",
        "chargedAt",
        "sourceSubject",
        "cycleHint",
        "confidence",
        "needsReview",
      ]),
    );
  });
});
