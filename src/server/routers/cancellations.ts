import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { currentUser } from "@clerk/nextjs/server";
import { protectedProcedure, router } from "../trpc";
import { cancellationRequests, merchants, subscriptions } from "@/db/schema";
import {
  canTransition,
  draftCancellationEmail,
  statusLabel,
} from "@/services/cancellation-email";
import { formatMinor } from "@/lib/money";

// "Prepare cancellation email" flow (§8 P0). The ledger is explicit:
// draft → request_sent → provider_confirmed. Only provider_confirmed is
// "done" (§10.2), and SubZero never sends email itself (read-only scope).

export const cancellationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        request: cancellationRequests,
        subscription: {
          id: subscriptions.id,
          name: subscriptions.name,
          amountMinor: subscriptions.amountMinor,
          currency: subscriptions.currency,
          cycle: subscriptions.cycle,
        },
        merchant: {
          cancelUrl: merchants.cancelUrl,
          cancelEmail: merchants.cancelEmail,
          difficulty: merchants.difficulty,
          domains: merchants.domains,
        },
      })
      .from(cancellationRequests)
      .innerJoin(subscriptions, eq(cancellationRequests.subscriptionId, subscriptions.id))
      .leftJoin(merchants, eq(subscriptions.merchantId, merchants.id))
      .where(eq(cancellationRequests.userId, ctx.userId))
      .orderBy(desc(cancellationRequests.createdAt));
    return rows.map((row) => ({
      ...row.request,
      statusLabel: statusLabel(row.request.status),
      subscription: row.subscription,
      merchant: row.merchant,
    }));
  }),

  /** Draft the escape path for one subscription: playbook + email draft. */
  prepare: protectedProcedure
    .input(z.object({ subscriptionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const row = (
        await ctx.db
          .select({ subscription: subscriptions, merchant: merchants })
          .from(subscriptions)
          .leftJoin(merchants, eq(subscriptions.merchantId, merchants.id))
          .where(
            and(
              eq(subscriptions.id, input.subscriptionId),
              eq(subscriptions.userId, ctx.userId),
            ),
          )
          .limit(1)
      )[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const user = await currentUser();
      const accountEmail = user?.primaryEmailAddress?.emailAddress ?? "";
      const userName = user?.fullName ?? user?.firstName ?? "SubZero user";

      const draft = draftCancellationEmail({
        merchantName: row.subscription.name,
        userName,
        accountEmail,
        amountFormatted: formatMinor(row.subscription.amountMinor, row.subscription.currency),
        cycle: row.subscription.cycle,
        lastChargeDate: row.subscription.lastChargeAt?.toISOString().slice(0, 10),
      });

      const method = row.merchant?.cancelMethod ?? "email";
      const inserted = await ctx.db
        .insert(cancellationRequests)
        .values({
          userId: ctx.userId,
          subscriptionId: row.subscription.id,
          status: "draft",
          method,
          draftSubject: draft.subject,
          draftBody: draft.body,
        })
        .returning({ id: cancellationRequests.id });

      return {
        requestId: inserted[0]!.id,
        draft,
        method,
        cancelUrl: row.merchant?.cancelUrl ?? null,
        cancelEmail: row.merchant?.cancelEmail ?? null,
        difficulty: row.merchant?.difficulty ?? null,
      };
    }),

  /**
   * User says they sent the request. Subscription is NOT "cancelled" yet.
   * Optionally persists the edited draft, so the ledger records what was
   * actually sent rather than the original template.
   */
  markSent: protectedProcedure
    .input(
      z.object({
        requestId: z.number().int(),
        draftSubject: z.string().max(500).optional(),
        draftBody: z.string().max(10_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ownedRequest(ctx, input.requestId);
      if (!canTransition(request.status, "request_sent")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot mark ${request.status} as sent.` });
      }
      await ctx.db
        .update(cancellationRequests)
        .set({
          status: "request_sent",
          sentAt: new Date(),
          ...(input.draftSubject ? { draftSubject: input.draftSubject } : {}),
          ...(input.draftBody ? { draftBody: input.draftBody } : {}),
        })
        .where(eq(cancellationRequests.id, input.requestId));
      await ctx.db
        .update(subscriptions)
        .set({ status: "cancellation_requested" })
        .where(
          and(
            eq(subscriptions.id, request.subscriptionId),
            eq(subscriptions.userId, ctx.userId),
          ),
        );
      return { ok: true, statusLabel: statusLabel("request_sent") };
    }),

  /** Provider confirmed — the only "done" (§10.2). */
  confirm: protectedProcedure
    .input(z.object({ requestId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ownedRequest(ctx, input.requestId);
      if (!canTransition(request.status, "provider_confirmed")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot confirm a request in status ${request.status}.`,
        });
      }
      await ctx.db
        .update(cancellationRequests)
        .set({ status: "provider_confirmed", confirmedAt: new Date() })
        .where(eq(cancellationRequests.id, input.requestId));
      await ctx.db
        .update(subscriptions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(subscriptions.id, request.subscriptionId),
            eq(subscriptions.userId, ctx.userId),
          ),
        );
      return { ok: true, statusLabel: statusLabel("provider_confirmed") };
    }),
});

async function ownedRequest(
  ctx: { db: typeof import("@/db/client").db; userId: string },
  requestId: number,
) {
  const request = (
    await ctx.db
      .select()
      .from(cancellationRequests)
      .where(
        and(eq(cancellationRequests.id, requestId), eq(cancellationRequests.userId, ctx.userId)),
      )
      .limit(1)
  )[0];
  if (!request) throw new TRPCError({ code: "NOT_FOUND" });
  return request;
}
