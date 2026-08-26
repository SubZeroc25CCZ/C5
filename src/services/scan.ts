// Scan worker: backfill (24 months) and daily delta sync (§5.4). Fetches
// candidates via the targeted query set, runs the two-stage pipeline, then
// re-runs recurrence detection. Raw bodies never leave this call stack (§6).

import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { charges, emailAccounts } from "@/db/schema";
import { decryptToken } from "@/lib/encryption";
import { buildBackfillQueries, buildDeltaQueries } from "@/ingestion/gmail-queries";
import { fetchCandidate, listCandidateIds, refreshAccessToken } from "@/ingestion/gmail-client";
import { MerchantMatcher } from "@/ingestion/stage1-matcher";
import { processBatch, type PipelineLogger, type PipelineStats } from "@/ingestion/pipeline";
import { ClaudeExtractionModel, type ExtractionModel } from "@/ingestion/stage2-extractor";
import { seedAsRecords } from "@/merchants/seed";
import { syncSubscriptionsForUser, type SyncResult } from "./subscription-sync";

export interface ScanOutcome {
  pipeline: PipelineStats;
  sync: SyncResult;
  /** Batch progress: how much of the candidate set this call covered. */
  candidates: { total: number; processed: number; remaining: number };
}

const structuredLogger: PipelineLogger = {
  info: (message, fields) => console.log(JSON.stringify({ level: "info", message, ...fields })),
  warn: (message, fields) => console.warn(JSON.stringify({ level: "warn", message, ...fields })),
};

export async function runScan(
  db: Database,
  options: {
    userId: string;
    emailAccountId: number;
    mode: "backfill" | "delta";
    /** Serverless-friendly batching: process at most this many new messages
     *  per call; the client keeps calling until `remaining` hits 0. */
    maxMessages?: number;
    model?: ExtractionModel;
    logger?: PipelineLogger;
  },
): Promise<ScanOutcome> {
  const account = (
    await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, options.emailAccountId))
      .limit(1)
  )[0];
  if (!account || account.userId !== options.userId) {
    throw new Error("Email account not found");
  }
  if (account.status !== "active" || !account.encryptedRefreshToken) {
    throw new Error("Email account is not connected");
  }

  const refreshToken = decryptToken(options.userId, account.encryptedRefreshToken);
  const accessToken = await refreshAccessToken(refreshToken);

  const matcher = new MerchantMatcher(seedAsRecords());
  const domains = matcher.knownDomains();
  const sinceDays = account.lastSyncedAt
    ? (Date.now() - account.lastSyncedAt.getTime()) / 86_400_000 + 1
    : 30;
  const queries =
    options.mode === "backfill"
      ? buildBackfillQueries(domains)
      : buildDeltaQueries(domains, sinceDays);

  const ids = await listCandidateIds(accessToken, queries);

  // Skip messages already ingested (idempotent re-scans).
  const seen = new Set(
    (
      await db
        .select({ ref: charges.sourceMessageRef })
        .from(charges)
        .where(eq(charges.userId, options.userId))
    ).map((row) => row.ref),
  );
  const newIds = ids.filter((id) => !seen.has(id));
  const batchIds = options.maxMessages ? newIds.slice(0, options.maxMessages) : newIds;

  const candidates = [];
  for (const id of batchIds) {
    candidates.push(await fetchCandidate(accessToken, id));
  }

  const logger = options.logger ?? structuredLogger;
  const pipeline = await processBatch(candidates, {
    matcher,
    model: options.model ?? new ClaudeExtractionModel(),
    logger,
    sink: {
      save: async (charge) => {
        await db
          .insert(charges)
          .values({
            userId: options.userId,
            merchantId: charge.merchantId,
            merchantName: charge.merchantName,
            amountMinor: charge.amountMinor,
            currency: charge.currency,
            chargedAt: charge.chargedAt,
            sourceMessageRef: charge.messageId,
            sourceSubject: charge.sourceSubject,
            extractionConfidence: charge.confidence,
            detectedFrom: "email",
          })
          .onConflictDoNothing(); // unique (userId, sourceMessageRef) dedupes re-scans
      },
    },
  });

  const sync = await syncSubscriptionsForUser(db, options.userId);

  await db
    .update(emailAccounts)
    .set({ lastSyncedAt: new Date() })
    .where(eq(emailAccounts.id, account.id));

  return {
    pipeline,
    sync,
    candidates: {
      total: newIds.length,
      processed: batchIds.length,
      remaining: newIds.length - batchIds.length,
    },
  };
}
