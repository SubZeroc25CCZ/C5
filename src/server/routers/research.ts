import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { surveyResponses } from "@/db/schema";
import { track, type AnalyticsEvent } from "@/services/analytics";

// Beta research kit: the post-scan micro-survey and the client-side event
// sink. The survey is asked once per user, is never a paywall, and never
// gates the product — dismissing records "dismissed" so we stop asking.

const EVENT_NAMES = [
  "signed_in",
  "inbox_connected",
  "scan_started",
  "scan_completed",
  "results_viewed",
  "review_completed",
  "upgraded",
  "subscription_corrected",
  "review_accepted",
  "review_rejected",
  "subscription_ignored",
  "aggregator_split",
  "cancellation_drafted",
  "cancellation_sent",
  "cancellation_confirmed",
  "scan_failed",
] as const satisfies readonly AnalyticsEvent[];

export const researchRouter = router({
  /** Whether the post-scan survey should be shown to this user. */
  surveyStatus: protectedProcedure.query(async ({ ctx }) => {
    const existing = (
      await ctx.db
        .select({ id: surveyResponses.id })
        .from(surveyResponses)
        .where(
          and(
            eq(surveyResponses.userId, ctx.userId),
            eq(surveyResponses.survey, "post_scan"),
          ),
        )
        .limit(1)
    )[0];
    return { answered: !!existing };
  }),

  /** Submit (or dismiss) the post-scan micro-survey. Idempotent per user. */
  submitSurvey: protectedProcedure
    .input(
      z.object({
        accuracy: z.enum([
          "all_of_them",
          "mostly",
          "missed_a_lot",
          "found_forgotten",
          "dismissed",
        ]),
        missingText: z.string().max(2000).optional(),
        willingness: z
          .enum(["yes", "maybe_later", "too_expensive", "diy", "unanswered"])
          .default("unanswered"),
        willingnessText: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(surveyResponses)
        .values({
          userId: ctx.userId,
          survey: "post_scan",
          accuracy: input.accuracy,
          missingText: input.missingText?.trim() || null,
          willingness: input.willingness,
          willingnessText: input.willingnessText?.trim() || null,
        })
        .onConflictDoNothing(); // asked once, never again
      return { ok: true };
    }),

  /** Client-side funnel events (results_viewed, review_completed, …). */
  event: protectedProcedure
    .input(z.object({ name: z.enum(EVENT_NAMES), value: z.number().int().optional() }))
    .mutation(async ({ ctx, input }) => {
      await track(ctx.db, ctx.userId, input.name, input.value);
      return { ok: true };
    }),
});
