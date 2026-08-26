// The ingestion pipeline (§5.2 + §6). Candidates flow through Stage 1
// (merchant DB match + deterministic amount parse) and, only when that
// fails, Stage 2 (Claude extraction). The raw body exists in this function's
// scope and nowhere else: what leaves is a PersistableCharge — merchant,
// amount, currency, date, message ref, subject. tests/pipeline-privacy.test.ts
// asserts no body content ever reaches the persistence layer or the logger.

import type { EmailCandidate, PersistableCharge } from "./types";
import { MerchantMatcher } from "./stage1-matcher";
import { parseAmount } from "./amount-parser";
import { runStage2, type ExtractionModel } from "./stage2-extractor";
import { majorToMinor } from "@/lib/money";
import { isAggregatorMerchant } from "@/lib/aggregators";

export interface ChargeSink {
  save(charge: PersistableCharge): Promise<void>;
}

export interface PipelineLogger {
  info(message: string, fields?: Record<string, string | number | boolean>): void;
  warn(message: string, fields?: Record<string, string | number | boolean>): void;
}

export interface PipelineDeps {
  matcher: MerchantMatcher;
  model: ExtractionModel;
  sink: ChargeSink;
  logger: PipelineLogger;
}

export interface PipelineStats {
  processed: number;
  stage1Hits: number;
  stage2Hits: number;
  needsReview: number;
  discarded: number;
}

/** Process one candidate. Returns what was persisted (or null if discarded). */
export async function processCandidate(
  candidate: EmailCandidate,
  deps: PipelineDeps,
): Promise<PersistableCharge[] | null> {
  const merchant = deps.matcher.match(candidate.from);

  // Aggregator storefronts (D6: Apple, Google, PayPal, …) bill many services
  // on one receipt. Stage 1's single-total charge would bury the line items —
  // and the body is discarded after this scan, so they'd be unrecoverable.
  // Route them through Stage 2, which extracts items[].
  const aggregator = !!merchant && isAggregatorMerchant(merchant.name);

  // Stage 1: known sender + deterministically parseable amount. Zero AI cost.
  if (merchant && !aggregator) {
    const parsed = parseAmount(candidate.body);
    if (parsed) {
      const charge: PersistableCharge = {
        messageId: candidate.messageId,
        merchantName: merchant.name,
        merchantId: merchant.id,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        chargedAt: candidate.receivedAt,
        sourceSubject: candidate.subject,
        cycleHint: "unknown",
        confidence: null, // deterministic — not an AI guess
        needsReview: false,
      };
      await deps.sink.save(charge);
      deps.logger.info("stage1_hit", { messageId: candidate.messageId, merchant: merchant.name });
      return [charge];
    }
  }

  // Stage 2: ambiguous candidates only. A model failure on one email must
  // not abort a whole scan — the candidate is discarded (it can be picked
  // up by a later re-scan) and the scan continues.
  let outcome: Awaited<ReturnType<typeof runStage2>>;
  try {
    outcome = await runStage2(deps.model, {
      from: candidate.from,
      subject: candidate.subject,
      body: candidate.body,
    });
  } catch {
    deps.logger.warn("stage2_error", { messageId: candidate.messageId });
    return null;
  }

  if (!outcome.charge) {
    deps.logger.info("discarded", { messageId: candidate.messageId });
    return null;
  }

  // One-time purchases are receipts, not subscription evidence.
  if (outcome.charge.cycleHint === "one_time") {
    deps.logger.info("discarded_one_time", { messageId: candidate.messageId });
    return null;
  }

  const parsedDate = new Date(outcome.charge.chargedAt);
  const chargedAt = Number.isNaN(parsedDate.getTime()) ? candidate.receivedAt : parsedDate;
  const currency = outcome.charge.currency.toUpperCase();
  const confidence = Math.round(outcome.charge.confidence * 100);

  // D6: a storefront receipt with ≥2 line items becomes one charge PER item,
  // each named for its service — so "iCloud+" and "Apple Music" build their
  // own recurrence instead of drowning in a varying "Apple" total. The ref
  // suffix (#0, #1, …) keeps the (userId, sourceMessageRef) uniqueness while
  // staying traceable to the one source email.
  const items = outcome.charge.items;
  const charges: PersistableCharge[] =
    items.length >= 2
      ? items.map((item, index) => ({
          messageId: `${candidate.messageId}#${index}`,
          merchantName: item.name,
          merchantId: merchant?.id ?? null,
          amountMinor: majorToMinor(item.amount, currency),
          currency,
          chargedAt,
          sourceSubject: candidate.subject,
          cycleHint: "unknown" as const,
          confidence,
          needsReview: outcome.needsReview,
        }))
      : [
          {
            messageId: candidate.messageId,
            merchantName: outcome.charge.merchant,
            merchantId: merchant?.id ?? null,
            amountMinor: majorToMinor(outcome.charge.amount, currency),
            currency,
            chargedAt,
            sourceSubject: candidate.subject,
            cycleHint: outcome.charge.cycleHint, // "one_time" already returned above
            confidence,
            needsReview: outcome.needsReview,
          },
        ];

  for (const charge of charges) {
    await deps.sink.save(charge);
  }
  deps.logger.info("stage2_hit", {
    messageId: candidate.messageId,
    needsReview: outcome.needsReview,
    items: items.length,
  });
  return charges;
  // candidate.body goes out of scope here — process and discard (§6).
}

export async function processBatch(
  candidates: EmailCandidate[],
  deps: PipelineDeps,
): Promise<PipelineStats> {
  const stats: PipelineStats = {
    processed: 0,
    stage1Hits: 0,
    stage2Hits: 0,
    needsReview: 0,
    discarded: 0,
  };
  for (const candidate of candidates) {
    const saved = await processCandidate(candidate, deps);
    stats.processed += 1;
    if (!saved || saved.length === 0) {
      stats.discarded += 1;
    } else if (saved[0].confidence === null) {
      stats.stage1Hits += 1;
    } else {
      stats.stage2Hits += 1;
      if (saved[0].needsReview) stats.needsReview += 1;
    }
  }
  return stats;
}
