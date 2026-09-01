import { z } from "zod";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import {
  cancellationRequests,
  charges,
  merchants,
  priceChanges,
  subscriptionEvidence,
  subscriptions,
} from "@/db/schema";
import { portfolioTotalsByCurrency } from "@/engine/normalize";
import { minorToMajor } from "@/lib/money";
import { isAggregatorMerchant } from "@/lib/aggregators";
import { ACCESS_LIMITS } from "@/lib/quota";
import { userAccess } from "../plan";
import { customerMerchant } from "../merchant-view";
import { track } from "@/services/analytics";
import { redactListForTeaser, unlockedSubscriptionId } from "@/services/redaction";

const cycleSchema = z.enum(["weekly", "monthly", "quarterly", "yearly"]);

export const subscriptionsRouter = router({
  /** Dashboard payload: all subscriptions + per-currency normalized totals. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        subscription: subscriptions,
        merchant: merchants,
      })
      .from(subscriptions)
      .leftJoin(merchants, eq(subscriptions.merchantId, merchants.id))
      .where(eq(subscriptions.userId, ctx.userId))
      .orderBy(desc(subscriptions.lastChargeAt));

    // D6: evidence counts + observed spend per subscription — the badge must
    // equal the evidence count, and unconfirmed/aggregator rows show observed
    // totals instead of a per-month claim.
    const subIds = rows.map((row) => row.subscription.id);
    const evidenceAgg =
      subIds.length > 0
        ? await ctx.db
            .select({
              subscriptionId: subscriptionEvidence.subscriptionId,
              evidenceCount: sql<number>`count(*)`,
              observedTotalMinor: sql<number>`coalesce(sum(${charges.amountMinor}), 0)`,
            })
            .from(subscriptionEvidence)
            .innerJoin(charges, eq(subscriptionEvidence.chargeId, charges.id))
            .where(
              and(
                inArray(subscriptionEvidence.subscriptionId, subIds),
                eq(charges.userId, ctx.userId),
              ),
            )
            .groupBy(subscriptionEvidence.subscriptionId)
        : [];
    const evidenceBySub = new Map(evidenceAgg.map((entry) => [entry.subscriptionId, entry]));

    const enriched = rows.map((row) => ({
      ...row,
      // §4.6: unverified cancel URLs are stripped before they reach a client.
      merchant: customerMerchant(row.merchant),
      evidenceCount: evidenceBySub.get(row.subscription.id)?.evidenceCount ?? 1,
      observedTotalMinor:
        evidenceBySub.get(row.subscription.id)?.observedTotalMinor ??
        row.subscription.amountMinor,
      // Storefront aggregators (D6): observed spend group, never a monthly
      // claim. Judged by the SUBSCRIPTION's own name only: split per-service
      // subs (iCloud+, Apple Music) deliberately keep the storefront's
      // merchantId for logo/playbook, and must not be re-flagged by it.
      aggregator: isAggregatorMerchant(row.subscription.name),
    }));

    // Only confirmed, active, non-aggregator subscriptions feed the totals
    // (§10.1 + D6): a "possible" sighting is evidence, not spend; a
    // storefront total has no stable cycle to normalize.
    const totals = portfolioTotalsByCurrency(
      enriched
        .filter((row) => row.subscription.status === "active" && !row.aggregator)
        .map((row) => ({
          amount: minorToMajor(row.subscription.amountMinor, row.subscription.currency),
          cycle: row.subscription.cycle,
          status: "active",
          currency: row.subscription.currency,
          category: row.merchant?.category,
        })),
    );

    // Price increases observed in the last 60 days — the alert banner.
    const recentPriceChanges =
      subIds.length > 0
        ? await ctx.db
            .select()
            .from(priceChanges)
            .where(
              and(
                inArray(priceChanges.subscriptionId, subIds),
                gte(priceChanges.observedAt, new Date(Date.now() - 60 * 86_400_000)),
              ),
            )
            .orderBy(desc(priceChanges.observedAt))
        : [];

    // Teaser plan (D5): redact at the API layer — totals, counts, and the
    // single most expensive confirmed subscription are all that leave the
    // server; every other row becomes a locked placeholder.
    const access = await userAccess(ctx.db, ctx.userId);
    if (!ACCESS_LIMITS[access].fullResults) {
      return redactListForTeaser({ subscriptions: enriched, totals, recentPriceChanges });
    }

    return {
      teaser: false as const,
      subscriptions: enriched,
      totals,
      recentPriceChanges,
      counts: {
        total: enriched.length,
        confirmed: enriched.filter((row) => row.subscription.status === "active").length,
        possible: enriched.filter((row) => row.subscription.status === "possible").length,
      },
    };
  }),

  /** Full detail for one subscription: merchant, evidence, price history, cancellations. */
  get: protectedProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
    const row = (
      await ctx.db
        .select({ subscription: subscriptions, merchant: merchants })
        .from(subscriptions)
        .leftJoin(merchants, eq(subscriptions.merchantId, merchants.id))
        .where(and(eq(subscriptions.id, input.id), eq(subscriptions.userId, ctx.userId)))
        .limit(1)
    )[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    await assertPlanSeesSubscription(ctx, input.id);

    const links = await ctx.db
      .select({ chargeId: subscriptionEvidence.chargeId })
      .from(subscriptionEvidence)
      .where(eq(subscriptionEvidence.subscriptionId, input.id));
    const evidence =
      links.length > 0
        ? await ctx.db
            .select()
            .from(charges)
            .where(
              and(
                eq(charges.userId, ctx.userId),
                inArray(
                  charges.id,
                  links.map((link) => link.chargeId),
                ),
              ),
            )
            .orderBy(desc(charges.chargedAt))
        : [];

    const history = await ctx.db
      .select()
      .from(priceChanges)
      .where(eq(priceChanges.subscriptionId, input.id))
      .orderBy(desc(priceChanges.observedAt));

    const requests = await ctx.db
      .select()
      .from(cancellationRequests)
      .where(
        and(
          eq(cancellationRequests.subscriptionId, input.id),
          eq(cancellationRequests.userId, ctx.userId),
        ),
      )
      .orderBy(desc(cancellationRequests.createdAt));

    return {
      ...row,
      merchant: customerMerchant(row.merchant),
      evidence,
      priceChanges: history,
      cancellationRequests: requests,
    };
  }),

  /** Every AI-extracted field is editable (§10.3). */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255).optional(),
        amountMinor: z.number().int().nonnegative().optional(),
        currency: z.string().length(3).optional(),
        cycle: cycleSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      await assertOwnership(ctx, id);
      await assertPlanSeesSubscription(ctx, id);
      await ctx.db
        .update(subscriptions)
        .set({ ...fields, currency: fields.currency?.toUpperCase() })
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, ctx.userId)));
      // Accuracy signal (§3.2): every correction is extraction feedback.
      await track(ctx.db, ctx.userId, "subscription_corrected");
      return { ok: true };
    }),

  setStatus: protectedProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(["active", "ignored"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx, input.id);
      await assertPlanSeesSubscription(ctx, input.id);
      await ctx.db
        .update(subscriptions)
        .set({ status: input.status })
        .where(and(eq(subscriptions.id, input.id), eq(subscriptions.userId, ctx.userId)));
      if (input.status === "ignored") {
        await track(ctx.db, ctx.userId, "subscription_ignored");
      }
      return { ok: true };
    }),

  /** The "what we saw" log (§6): which emails produced this subscription. */
  whatWeSaw: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertOwnership(ctx, input.id);
      await assertPlanSeesSubscription(ctx, input.id);
      const links = await ctx.db
        .select({ chargeId: subscriptionEvidence.chargeId })
        .from(subscriptionEvidence)
        .where(eq(subscriptionEvidence.subscriptionId, input.id));
      if (links.length === 0) return [];
      const rows = await ctx.db
        .select({
          chargedAt: charges.chargedAt,
          subject: charges.sourceSubject,
          messageRef: charges.sourceMessageRef,
          amountMinor: charges.amountMinor,
          currency: charges.currency,
          extractionConfidence: charges.extractionConfidence,
        })
        .from(charges)
        .where(
          and(
            eq(charges.userId, ctx.userId),
            inArray(
              charges.id,
              links.map((link) => link.chargeId),
            ),
          ),
        )
        .orderBy(desc(charges.chargedAt));
      return rows;
    }),
});

/**
 * Teaser users can open (and edit) only their one unlocked subscription —
 * the same selection the redacted list exposes. Everything else is behind
 * the paywall, enforced server-side.
 */
async function assertPlanSeesSubscription(
  ctx: { db: typeof import("@/db/client").db; userId: string },
  subscriptionId: number,
) {
  const access = await userAccess(ctx.db, ctx.userId);
  if (ACCESS_LIMITS[access].fullResults) return;
  const rows = await ctx.db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      amountMinor: subscriptions.amountMinor,
      currency: subscriptions.currency,
      cycle: subscriptions.cycle,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, ctx.userId));
  const unlockedId = unlockedSubscriptionId(rows.map((r) => ({ subscription: r })));
  if (subscriptionId !== unlockedId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This subscription is locked on the free scan — the Cleanup Pass unlocks everything.",
    });
  }
}

async function assertOwnership(
  ctx: { db: typeof import("@/db/client").db; userId: string },
  subscriptionId: number,
) {
  const row = (
    await ctx.db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1)
  )[0];
  if (!row || row.userId !== ctx.userId) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
}
