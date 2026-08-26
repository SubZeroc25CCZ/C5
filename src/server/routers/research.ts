import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { surveyResponses } from "@/db/schema";
import { ANON_ACTOR, track, type AnalyticsEvent } from "@/services/analytics";
import { createRateLimiter } from "@/lib/rate-limit";

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

/** The subset a signed-out visitor may report (conversion brief §11). */
const LANDING_EVENT_NAMES = [
  "landing_view",
  "hero_cta_clicked",
  "oauth_started",
  "oauth_completed",
  "oauth_failed",
  "demo_step_viewed",
  "pricing_viewed",
  "faq_opened",
  "final_cta_clicked",
] as const satisfies readonly AnalyticsEvent[];

/** Generous for a real visitor, tight enough that the endpoint isn't a firehose. */
const landingEventLimiter = createRateLimiter({ limit: 40, windowMs: 60_000 });

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

  /**
   * Landing-page events (conversion brief §11), from signed-out visitors.
   *
   * Public by necessity: the whole point is measuring what happens BEFORE
   * sign-in. Signed-in visitors are attributed normally; everyone else lands
   * on the shared ANON_ACTOR, so this records volume and never a person.
   *
   * A public write endpoint is an abuse surface, so it is rate limited per
   * IP and carries no free-text field — the name is a closed enum and the
   * only payload is one small integer.
   */
  landingEvent: publicProcedure
    .input(
      z.object({
        name: z.enum(LANDING_EVENT_NAMES),
        value: z.number().int().min(0).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.userId ?? ANON_ACTOR;
      if (!ctx.userId) {
        const key = ctx.ip ?? "unknown";
        const { allowed } = await landingEventLimiter(key);
        if (!allowed) return { ok: false };
      }
      await track(ctx.db, actor, input.name, input.value);
      return { ok: true };
    }),
});
