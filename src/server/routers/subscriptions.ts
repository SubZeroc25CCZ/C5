import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { charges, merchants, subscriptionEvidence, subscriptions } from "@/db/schema";
import { portfolioTotalsByCurrency } from "@/engine/normalize";
import { minorToMajor } from "@/lib/money";

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

    // Only confirmed, active subscriptions feed the totals (§10.1): a
    // "possible" sighting is evidence, not a number we display as spend.
    const totals = portfolioTotalsByCurrency(
      rows
        .filter((row) => row.subscription.status === "active")
        .map((row) => ({
          amount: minorToMajor(row.subscription.amountMinor, row.subscription.currency),
          cycle: row.subscription.cycle,
          status: "active",
          currency: row.subscription.currency,
          category: row.merchant?.category,
        })),
    );

    return { subscriptions: rows, totals };
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
      await ctx.db
        .update(subscriptions)
        .set({ ...fields, currency: fields.currency?.toUpperCase() })
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, ctx.userId)));
      return { ok: true };
    }),

  setStatus: protectedProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(["active", "ignored"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx, input.id);
      await ctx.db
        .update(subscriptions)
        .set({ status: input.status })
        .where(and(eq(subscriptions.id, input.id), eq(subscriptions.userId, ctx.userId)));
      return { ok: true };
    }),

  /** The "what we saw" log (§6): which emails produced this subscription. */
  whatWeSaw: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await assertOwnership(ctx, input.id);
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
