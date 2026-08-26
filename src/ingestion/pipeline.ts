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
): Promise<PersistableCharge | null> {
  const merchant = deps.matcher.match(candidate.from);

  // Stage 1: known sender + deterministically parseable amount. Zero AI cost.
  if (merchant) {
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
      return charge;
    }
  }

  // Stage 2: ambiguous candidates only.
  const outcome = await runStage2(deps.model, {
    from: candidate.from,
    subject: candidate.subject,
    body: candidate.body,
  });

  if (!outcome.charge) {
    deps.logger.info("discarded", { messageId: candidate.messageId });
    return null;
  }

  // One-time purchases are receipts, not subscription evidence.
  if (outcome.charge.cycleHint === "one_time") {
    deps.logger.info("discarded_one_time", { messageId: candidate.messageId });
    return null;
  }

  const chargedAt = new Date(outcome.charge.chargedAt);
  const charge: PersistableCharge = {
    messageId: candidate.messageId,
    merchantName: outcome.charge.merchant,
    merchantId: merchant?.id ?? null,
    amountMinor: majorToMinor(outcome.charge.amount, outcome.charge.currency),
    currency: outcome.charge.currency.toUpperCase(),
    chargedAt: Number.isNaN(chargedAt.getTime()) ? candidate.receivedAt : chargedAt,
    sourceSubject: candidate.subject,
    cycleHint: outcome.charge.cycleHint, // "one_time" already returned above
    confidence: Math.round(outcome.charge.confidence * 100),
    needsReview: outcome.needsReview,
  };
  await deps.sink.save(charge);
  deps.logger.info("stage2_hit", {
    messageId: candidate.messageId,
    needsReview: outcome.needsReview,
  });
  return charge;
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
    if (!saved) {
      stats.discarded += 1;
    } else if (saved.confidence === null) {
      stats.stage1Hits += 1;
    } else {
      stats.stage2Hits += 1;
      if (saved.needsReview) stats.needsReview += 1;
    }
  }
  return stats;
}
