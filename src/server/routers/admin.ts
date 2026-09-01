import { z } from "zod";
import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { adminProcedure, audit } from "../admin";
import {
  adminAuditLog,
  analyticsEvents,
  cancellationRequests,
  charges,
  emailAccounts,
  merchants,
  profiles,
  scanRuns,
  subscriptions,
  surveyResponses,
  users,
} from "@/db/schema";

// Admin panel data (§4). Everything here obeys the security rules: no email
// bodies (they no longer exist), no OAuth tokens or key material in any
// select, and every mutation writes the audit log before it completes.

const DAY_MS = 86_400_000;

/** Traffic light for a subsystem (§4.1: red/amber/green). */
type Health = "green" | "amber" | "red";

function healthFromRate(rate: number, amberAt: number, redAt: number): Health {
  if (rate >= redAt) return "red";
  if (rate >= amberAt) return "amber";
  return "green";
}

/** The activation funnel, in order (research kit §3.1). */
const FUNNEL_STEPS = [
  "signed_in",
  "inbox_connected",
  "scan_started",
  "scan_completed",
  "results_viewed",
  "upgraded",
] as const;

export const adminRouter = router({
  /** 4.1 — system health and the beta research numbers on one screen. */
  health: adminProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - DAY_MS);

    const [
      userCount,
      inboxRows,
      scansToday,
      failedToday,
      reviewBacklog,
      merchantRows,
      funnelRows,
      accuracyRows,
      surveyRows,
      cancellationRows,
      durationRow,
    ] = await Promise.all([
      ctx.db.select({ value: count() }).from(users),
      ctx.db
        .select({ status: emailAccounts.status, value: count() })
        .from(emailAccounts)
        .groupBy(emailAccounts.status),
      ctx.db.select({ value: count() }).from(scanRuns).where(gte(scanRuns.startedAt, since)),
      ctx.db
        .select({ value: count() })
        .from(scanRuns)
        .where(and(gte(scanRuns.startedAt, since), eq(scanRuns.status, "failed"))),
      ctx.db
        .select({ value: count() })
        .from(charges)
        .where(
          and(
            isNotNull(charges.extractionConfidence),
            lt(charges.extractionConfidence, 80),
            isNull(charges.reviewedAt),
          ),
        ),
      ctx.db
        .select({
          total: count(),
          verified: sql<number>`sum(case when ${merchants.cancelUrlVerifiedAt} is not null then 1 else 0 end)`,
        })
        .from(merchants),
      // Funnel: distinct users per step, not raw event counts.
      ctx.db
        .select({
          name: analyticsEvents.name,
          users: sql<number>`count(distinct ${analyticsEvents.userId})`,
        })
        .from(analyticsEvents)
        .where(inArray(analyticsEvents.name, [...FUNNEL_STEPS]))
        .groupBy(analyticsEvents.name),
      ctx.db
        .select({ name: analyticsEvents.name, events: count() })
        .from(analyticsEvents)
        .where(
          inArray(analyticsEvents.name, [
            "subscription_corrected",
            "review_accepted",
            "review_rejected",
            "subscription_ignored",
            "aggregator_split",
            "cancellation_drafted",
            "cancellation_sent",
            "cancellation_confirmed",
          ]),
        )
        .groupBy(analyticsEvents.name),
      ctx.db
        .select({ accuracy: surveyResponses.accuracy, value: count() })
        .from(surveyResponses)
        .groupBy(surveyResponses.accuracy),
      ctx.db
        .select({ status: cancellationRequests.status, value: count() })
        .from(cancellationRequests)
        .groupBy(cancellationRequests.status),
      ctx.db
        .select({
          p50: sql<number>`cast(avg(${scanRuns.durationMs}) as integer)`,
          slowest: sql<number>`max(${scanRuns.durationMs})`,
        })
        .from(scanRuns)
        .where(and(gte(scanRuns.startedAt, since), eq(scanRuns.status, "succeeded"))),
    ]);

    const scans = scansToday[0]?.value ?? 0;
    const failed = failedToday[0]?.value ?? 0;
    const errorRate = scans > 0 ? failed / scans : 0;
    const inboxes = Object.fromEntries(inboxRows.map((row) => [row.status, row.value]));
    const funnel = new Map(funnelRows.map((row) => [row.name, row.users]));
    const signals = Object.fromEntries(accuracyRows.map((row) => [row.name, row.events]));

    const merchantTotals = merchantRows[0] ?? { total: 0, verified: 0 };

    return {
      counts: {
        users: userCount[0]?.value ?? 0,
        inboxesActive: inboxes.active ?? 0,
        inboxesErrored: (inboxes.error ?? 0) + (inboxes.revoked ?? 0),
        scansToday: scans,
        reviewBacklog: reviewBacklog[0]?.value ?? 0,
        merchants: merchantTotals.total,
        merchantsVerified: Number(merchantTotals.verified ?? 0),
      },
      subsystems: {
        // A scan error rate over 10% is amber, over 25% red.
        scanning: healthFromRate(errorRate, 0.1, 0.25),
        // Any revoked/errored inbox is worth a look; a fifth of them is red.
        inboxes: healthFromRate(
          (inboxes.active ?? 0) + (inboxes.error ?? 0) > 0
            ? ((inboxes.error ?? 0) + (inboxes.revoked ?? 0)) /
                ((inboxes.active ?? 0) + (inboxes.error ?? 0) + (inboxes.revoked ?? 0))
            : 0,
          0.05,
          0.2,
        ),
        extraction:
          (reviewBacklog[0]?.value ?? 0) > 50
            ? "red"
            : (reviewBacklog[0]?.value ?? 0) > 10
              ? "amber"
              : "green",
      } satisfies Record<string, Health>,
      errorRate,
      scanDuration: {
        meanMs: durationRow[0]?.p50 ?? null,
        slowestMs: durationRow[0]?.slowest ?? null,
      },
      // Research kit §3.1 — the drop-off between any two steps is the
      // highest-value number in the business, so it is on the first screen.
      funnel: FUNNEL_STEPS.map((step) => ({ step, users: funnel.get(step) ?? 0 })),
      signals,
      survey: Object.fromEntries(surveyRows.map((row) => [row.accuracy, row.value])),
      cancellations: Object.fromEntries(cancellationRows.map((row) => [row.status, row.value])),
    };
  }),

  /** 4.2 — every scan run, filterable by status. Metadata only. */
  scans: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["all", "running", "succeeded", "failed"]).default("all"),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .default({ status: "all", limit: 50 }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          run: scanRuns,
          address: emailAccounts.address,
        })
        .from(scanRuns)
        .leftJoin(emailAccounts, eq(scanRuns.emailAccountId, emailAccounts.id))
        .where(input.status === "all" ? undefined : eq(scanRuns.status, input.status))
        .orderBy(desc(scanRuns.startedAt))
        .limit(input.limit);

      return rows.map((row) => ({
        ...row.run,
        // §4.2 says pseudonymized: admins see which inbox failed and its
        // domain, never the full address of a customer's mailbox.
        inboxDomain: row.address ? row.address.split("@")[1] ?? null : null,
      }));
    }),

  /**
   * 4.4 — extraction quality. Stage 2 output beside the user's correction,
   * with the accept rate per confidence band that validates the 0.8
   * auto-accept threshold. Shows extracted fields + subject and date only:
   * bodies do not exist to show (security rule 1).
   */
  extractions: adminProcedure
    .input(
      z.object({ limit: z.number().int().min(1).max(200).default(50) }).default({ limit: 50 }),
    )
    .query(async ({ ctx, input }) => {
      const [sample, bands] = await Promise.all([
        ctx.db
          .select({
            id: charges.id,
            merchantName: charges.merchantName,
            amountMinor: charges.amountMinor,
            currency: charges.currency,
            chargedAt: charges.chargedAt,
            sourceSubject: charges.sourceSubject,
            confidence: charges.extractionConfidence,
            reviewedAt: charges.reviewedAt,
            matched: charges.merchantId,
          })
          .from(charges)
          .where(isNotNull(charges.extractionConfidence))
          .orderBy(desc(charges.createdAt))
          .limit(input.limit),
        // Accept rate by band: below the 80 threshold a charge only survives
        // if a user reviewed it, so reviewed/total is the acceptance signal.
        ctx.db
          .select({
            band: sql<string>`case
              when ${charges.extractionConfidence} >= 90 then '90-100'
              when ${charges.extractionConfidence} >= 80 then '80-89'
              when ${charges.extractionConfidence} >= 60 then '60-79'
              else '0-59' end`,
            total: count(),
            reviewed: sql<number>`sum(case when ${charges.reviewedAt} is not null then 1 else 0 end)`,
          })
          .from(charges)
          .where(isNotNull(charges.extractionConfidence))
          .groupBy(
            sql`case
              when ${charges.extractionConfidence} >= 90 then '90-100'
              when ${charges.extractionConfidence} >= 80 then '80-89'
              when ${charges.extractionConfidence} >= 60 then '60-79'
              else '0-59' end`,
          ),
      ]);

      return { sample, bands };
    }),

  /** 4.6 — the merchant directory. */
  merchants: adminProcedure
    .input(
      z
        .object({
          query: z.string().max(100).default(""),
          onlyUnverified: z.boolean().default(false),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .default({ query: "", onlyUnverified: false, limit: 50 }),
    )
    .query(async ({ ctx, input }) => {
      const filters = [];
      if (input.query) {
        filters.push(sql`lower(${merchants.name}) like ${`%${input.query.toLowerCase()}%`}`);
      }
      if (input.onlyUnverified) filters.push(isNull(merchants.cancelUrlVerifiedAt));

      return ctx.db
        .select()
        .from(merchants)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(merchants.name)
        .limit(input.limit);
    }),

  /**
   * 4.6 — edit a merchant. Publishing a cancel URL requires a source note
   * (§4.7); the URL stays unverified — and so invisible to customers —
   * until an admin records where it came from.
   */
  updateMerchant: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        cancelUrl: z.string().url().max(500).nullable().optional(),
        cancelEmail: z.string().email().max(255).nullable().optional(),
        cancelMethod: z.enum(["url", "email", "phone", "unknown"]).optional(),
        difficulty: z.number().int().min(1).max(5).optional(),
        category: z.string().min(1).max(100).optional(),
        /** Required to verify a cancel URL. Recorded in the merchant row. */
        verificationSource: z.string().min(3).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = (
        await ctx.db.select().from(merchants).where(eq(merchants.id, input.id)).limit(1)
      )[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const settingUrl = input.cancelUrl !== undefined && input.cancelUrl !== null;
      if (settingUrl && !input.verificationSource) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "A cancel URL needs a verification source note — unverified URLs never reach customers.",
        });
      }
      if (settingUrl && !input.cancelUrl!.startsWith("https://")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cancel URLs must be https." });
      }

      // Rule 3: the log is written before the change lands.
      await audit(ctx.db, ctx.userId, "merchant.update", {
        target: `merchant:${input.id}`,
        detail: describeMerchantChange(existing, input),
      });

      await ctx.db
        .update(merchants)
        .set({
          ...(input.cancelUrl !== undefined ? { cancelUrl: input.cancelUrl } : {}),
          ...(input.cancelEmail !== undefined ? { cancelEmail: input.cancelEmail } : {}),
          ...(input.cancelMethod ? { cancelMethod: input.cancelMethod } : {}),
          ...(input.difficulty ? { difficulty: input.difficulty } : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(settingUrl
            ? {
                cancelUrlVerifiedAt: new Date(),
                cancelUrlVerifiedBy: ctx.userId,
                cancelUrlSource: input.verificationSource,
              }
            : {}),
          // Clearing the URL clears its verification with it.
          ...(input.cancelUrl === null
            ? { cancelUrlVerifiedAt: null, cancelUrlVerifiedBy: null, cancelUrlSource: null }
            : {}),
        })
        .where(eq(merchants.id, input.id));

      return { ok: true };
    }),

  /** 4.12 — the audit log viewer. Read-only by construction. */
  auditLog: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).default({ limit: 100 }))
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(adminAuditLog)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(input.limit),
    ),

  /**
   * 4.8 (P0 slice) — billing distribution, so the founder can see the
   * free → Pass → Guardian split without opening Stripe. Pass holders keep
   * plan="free" (the Pass is a timestamp, not a plan), so they are counted
   * separately by expiry. Counts only; no customer rows.
   */
  plans: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ plan: profiles.plan, value: count() })
      .from(profiles)
      .groupBy(profiles.plan);
    const passActive = await ctx.db
      .select({ value: count() })
      .from(profiles)
      .where(gt(profiles.passExpiresAt, new Date()));
    const subs = await ctx.db.select({ value: count() }).from(subscriptions);
    return {
      plans: Object.fromEntries(rows.map((row) => [row.plan, row.value])),
      passActive: passActive[0]?.value ?? 0,
      subscriptionsTracked: subs[0]?.value ?? 0,
    };
  }),
});

/** A short, human-readable diff for the audit log — never secrets. */
function describeMerchantChange(
  existing: { cancelUrl: string | null; cancelMethod: string; difficulty: number; category: string },
  input: {
    cancelUrl?: string | null;
    cancelMethod?: string;
    difficulty?: number;
    category?: string;
    verificationSource?: string;
  },
): string {
  const parts: string[] = [];
  if (input.cancelUrl !== undefined && input.cancelUrl !== existing.cancelUrl) {
    parts.push(`cancelUrl ${existing.cancelUrl ?? "none"} → ${input.cancelUrl ?? "none"}`);
  }
  if (input.cancelMethod && input.cancelMethod !== existing.cancelMethod) {
    parts.push(`method ${existing.cancelMethod} → ${input.cancelMethod}`);
  }
  if (input.difficulty && input.difficulty !== existing.difficulty) {
    parts.push(`difficulty ${existing.difficulty} → ${input.difficulty}`);
  }
  if (input.category && input.category !== existing.category) {
    parts.push(`category ${existing.category} → ${input.category}`);
  }
  if (input.verificationSource) parts.push(`source: ${input.verificationSource}`);
  return parts.join("; ") || "no field changes";
}
