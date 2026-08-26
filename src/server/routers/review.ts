import { z } from "zod";
import { and, desc, eq, isNull, lt, isNotNull } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { charges } from "@/db/schema";
import { syncSubscriptionsForUser } from "@/services/subscription-sync";

// The needs-review queue (§5.2): Stage 2 extractions below the auto-accept
// threshold. Approving marks the charge reviewed and re-runs detection;
// rejecting deletes the charge (it was never shown as a subscription).

const needsReviewWhere = (userId: string) =>
  and(
    eq(charges.userId, userId),
    isNotNull(charges.extractionConfidence),
    lt(charges.extractionConfidence, 80),
    isNull(charges.reviewedAt),
  );

export const reviewRouter = router({
  queue: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(charges)
      .where(needsReviewWhere(ctx.userId))
      .orderBy(desc(charges.chargedAt));
  }),

  approve: protectedProcedure
    .input(
      z.object({
        chargeId: z.number().int(),
        // Every AI-extracted field is editable at approval time (§10.3).
        merchantName: z.string().min(1).max(255).optional(),
        amountMinor: z.number().int().positive().optional(),
        currency: z.string().length(3).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(charges)
        .set({
          reviewedAt: new Date(),
          merchantName: input.merchantName,
          amountMinor: input.amountMinor,
          currency: input.currency?.toUpperCase(),
        })
        .where(and(eq(charges.id, input.chargeId), eq(charges.userId, ctx.userId)));
      const sync = await syncSubscriptionsForUser(ctx.db, ctx.userId);
      return { ok: true, sync };
    }),

  reject: protectedProcedure
    .input(z.object({ chargeId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(charges)
        .where(and(eq(charges.id, input.chargeId), eq(charges.userId, ctx.userId)));
      return { ok: true };
    }),
});
