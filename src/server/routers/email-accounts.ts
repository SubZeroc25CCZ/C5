import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { emailAccounts, profiles } from "@/db/schema";
import { canConnectInbox, nextScanAt, scanDue, type Plan } from "@/lib/quota";
import { scanContinuationLimiter, scanLimiter } from "@/lib/rate-limit";
import { runScan } from "@/services/scan";
import { deleteDerivedDataForUser } from "@/services/subscription-sync";

async function userPlan(db: typeof import("@/db/client").db, userId: string): Promise<Plan> {
  const profile = (
    await db.select({ plan: profiles.plan }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  )[0];
  return profile?.plan ?? "free";
}

export const emailAccountsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: emailAccounts.id,
        provider: emailAccounts.provider,
        address: emailAccounts.address,
        status: emailAccounts.status,
        lastSyncedAt: emailAccounts.lastSyncedAt,
      })
      .from(emailAccounts)
      .where(eq(emailAccounts.userId, ctx.userId));
    return rows; // note: encrypted token column is never selected here
  }),

  /** Plan gate consulted by the connect flow before starting Google OAuth. */
  canConnect: protectedProcedure.query(async ({ ctx }) => {
    const plan = await userPlan(ctx.db, ctx.userId);
    const existing = await ctx.db
      .select({ id: emailAccounts.id })
      .from(emailAccounts)
      .where(and(eq(emailAccounts.userId, ctx.userId), eq(emailAccounts.status, "active")));
    return { allowed: canConnectInbox(plan, existing.length), plan, connected: existing.length };
  }),

  /**
   * Kick off (or continue) a scan. Batched for serverless limits: each call
   * processes up to 25 new messages and reports remaining; the client loops
   * with continuation=true until remaining is 0. Rate limits and cadence
   * gates apply to the first call of a scan, not its continuations.
   */
  scan: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int(),
        mode: z.enum(["backfill", "delta"]),
        continuation: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = (
        await ctx.db
          .select({ lastSyncedAt: emailAccounts.lastSyncedAt })
          .from(emailAccounts)
          .where(and(eq(emailAccounts.id, input.accountId), eq(emailAccounts.userId, ctx.userId)))
          .limit(1)
      )[0];
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });

      // The continuation flag is client-supplied, so it is only honored with
      // server-side proof a scan is actually in progress: a batch updated
      // lastSyncedAt within the last 15 minutes. Anything else is treated
      // as a fresh scan and pays the full rate limit + cadence gate.
      const genuineContinuation =
        !!input.continuation &&
        !!account.lastSyncedAt &&
        Date.now() - account.lastSyncedAt.getTime() < 15 * 60_000;

      if (genuineContinuation) {
        const rate = await scanContinuationLimiter(`scan-cont:${ctx.userId}`);
        if (!rate.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Scan batch limit reached — try again later.",
          });
        }
      } else {
        const rate = await scanLimiter(`scan:${ctx.userId}`);
        if (!rate.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Scan limit reached — try again later.",
          });
        }
      }

      const plan = await userPlan(ctx.db, ctx.userId);
      if (input.mode === "delta" && !genuineContinuation) {
        // Manual re-scans obey the plan cadence: free monthly, Pro daily (D2).
        if (!scanDue(plan, account.lastSyncedAt)) {
          const next = nextScanAt(plan, account.lastSyncedAt);
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Next re-scan unlocks ${next?.toLocaleDateString() ?? "soon"} on the free plan — Pro re-scans daily.`,
          });
        }
      }
      return runScan(ctx.db, {
        userId: ctx.userId,
        emailAccountId: input.accountId,
        mode: input.mode,
        maxMessages: 25,
      });
    }),

  /**
   * One-click revoke (§6): forget the token immediately; optionally delete
   * all derived data (charges, subscriptions, evidence, price changes).
   */
  disconnect: protectedProcedure
    .input(z.object({ accountId: z.number().int(), deleteDerivedData: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(emailAccounts)
        .set({ status: "revoked", encryptedRefreshToken: null, syncCursor: null })
        .where(and(eq(emailAccounts.id, input.accountId), eq(emailAccounts.userId, ctx.userId)));
      if (input.deleteDerivedData) {
        await deleteDerivedDataForUser(ctx.db, ctx.userId);
      }
      return { ok: true };
    }),
});
