// Scan worker: backfill (24 months) and daily delta sync (§5.4). Fetches
// candidates via the targeted query set, runs the two-stage pipeline, then
// re-runs recurrence detection. Raw bodies never leave this call stack (§6).

import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { charges, emailAccounts, scanRuns, scannedMessages } from "@/db/schema";
import { decryptToken } from "@/lib/encryption";
import { buildBackfillQueries, buildDeltaQueries } from "@/ingestion/gmail-queries";
import { fetchCandidate, listCandidateIds, refreshAccessToken } from "@/ingestion/gmail-client";
import { MerchantMatcher } from "@/ingestion/stage1-matcher";
import { processBatch, type PipelineLogger, type PipelineStats } from "@/ingestion/pipeline";
import { ClaudeExtractionModel, type ExtractionModel } from "@/ingestion/stage2-extractor";
import { seedAsRecords } from "@/merchants/seed";
import { syncSubscriptionsForUser, type SyncResult } from "./subscription-sync";
import { track } from "./analytics";

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

/** Pipeline stages, so a failed run says where it died (admin §4.2). */
type ScanStage = "auth" | "list" | "fetch" | "extract" | "persist" | "sync";

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
    /** Who started this run — recorded for admin scan monitoring. */
    trigger?: "user" | "cron" | "admin";
  },
): Promise<ScanOutcome> {
  const startedAt = Date.now();
  // One row per run, for admin 4.2. Written up front so a run that dies
  // mid-flight still appears — a scan that vanished is the failure mode
  // this table exists to catch. Metadata only; never message content.
  const runRow = await db
    .insert(scanRuns)
    .values({
      userId: options.userId,
      emailAccountId: options.emailAccountId,
      mode: options.mode,
      trigger: options.trigger ?? "user",
      status: "running",
    })
    .returning({ id: scanRuns.id });
  const runId = runRow[0]?.id;
  let stage: ScanStage = "auth";

  try {
    const outcome = await scanInner(db, options, (next) => {
      stage = next;
    });
    if (runId !== undefined) {
      const finishedAt = new Date();
      await db
        .update(scanRuns)
        .set({
          status: "succeeded",
          messagesTouched: outcome.candidates.processed,
          chargesFound: outcome.pipeline.stage1Hits + outcome.pipeline.stage2Hits,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt,
        })
        .where(eq(scanRuns.id, runId));
    }
    return outcome;
  } catch (error) {
    if (runId !== undefined) {
      const finishedAt = new Date();
      await db
        .update(scanRuns)
        .set({
          status: "failed",
          failedStage: stage,
          // Message only — never a payload, never message content.
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt,
        })
        .where(eq(scanRuns.id, runId));
    }
    await track(db, options.userId, "scan_failed");
    throw error;
  }
}

async function scanInner(
  db: Database,
  options: {
    userId: string;
    emailAccountId: number;
    mode: "backfill" | "delta";
    maxMessages?: number;
    model?: ExtractionModel;
    logger?: PipelineLogger;
  },
  setStage: (stage: ScanStage) => void,
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

  await track(db, options.userId, "scan_started");

  setStage("list");
  const ids = await listCandidateIds(accessToken, queries);

  // Skip messages already processed — whatever their outcome. The
  // scanned_messages ledger covers discarded candidates too, so batches
  // always make progress; the charges refs are kept for rows ingested
  // before the ledger existed.
  const seen = new Set<string | null>([
    ...(
      await db
        .select({ ref: scannedMessages.messageRef })
        .from(scannedMessages)
        .where(eq(scannedMessages.userId, options.userId))
    ).map((row) => row.ref),
    ...(
      await db
        .select({ ref: charges.sourceMessageRef })
        .from(charges)
        .where(eq(charges.userId, options.userId))
    ).map((row) => row.ref),
  ]);
  const newIds = ids.filter((id) => !seen.has(id));
  // The per-batch cap is only safe when the candidate set is stable across
  // batches. Backfill's window is anchored to a fixed 24-month `after:` date,
  // so truncating one batch leaves the rest listable on the next call. Delta's
  // window is derived from `account.lastSyncedAt`, which every batch advances
  // to now — a second delta batch would recompute a ~1-day window and no
  // longer list the older, still-unprocessed candidates, dropping them
  // permanently. Delta therefore drains in a single call (as the daily-sync
  // cron already does); its window is naturally bounded by the days since the
  // last sync.
  const batchLimit = options.mode === "backfill" ? options.maxMessages : undefined;
  const batchIds = batchLimit ? newIds.slice(0, batchLimit) : newIds;

  setStage("fetch");
  const candidates = [];
  for (const id of batchIds) {
    candidates.push(await fetchCandidate(accessToken, id));
  }

  setStage("extract");
  const logger = options.logger ?? structuredLogger;
  // D6 aggregator watch (§3.2): a storefront receipt that split into
  // per-service charges carries a "#n" suffix on its message ref.
  let splitCharges = 0;
  const pipeline = await processBatch(candidates, {
    matcher,
    model: options.model ?? new ClaudeExtractionModel(),
    logger,
    sink: {
      save: async (charge) => {
        if (charge.messageId.includes("#")) splitCharges += 1;
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

  setStage("persist");
  // Record every processed message id, persisted or not, so the next
  // batch never re-touches them.
  if (batchIds.length > 0) {
    await db
      .insert(scannedMessages)
      .values(batchIds.map((messageRef) => ({ userId: options.userId, messageRef })))
      .onConflictDoNothing();
  }

  if (splitCharges > 0) {
    await track(db, options.userId, "aggregator_split", splitCharges);
  }

  setStage("sync");
  const sync = await syncSubscriptionsForUser(db, options.userId);

  await db
    .update(emailAccounts)
    .set({ lastSyncedAt: new Date() })
    .where(eq(emailAccounts.id, account.id));

  await track(db, options.userId, "scan_completed", batchIds.length);

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
