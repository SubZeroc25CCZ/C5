// Product analytics for the beta research kit. Deliberately first-party:
// events live in our own D1 database, carry the pseudonymous Clerk id, a
// name, and at most one small number. No merchant names, no amounts, no
// email content (which no longer exists after a scan) — so nothing here can
// leak a user's subscriptions into a third-party tool.

import type { Database } from "@/db/client";
import { analyticsEvents } from "@/db/schema";

/** The activation funnel (§3.1) plus the accuracy and action signals. */
export type AnalyticsEvent =
  // funnel — one per user per step
  | "signed_in"
  | "inbox_connected"
  | "scan_started"
  | "scan_completed"
  | "results_viewed"
  | "review_completed"
  | "upgraded"
  // accuracy signals (§3.2)
  | "subscription_corrected"
  | "review_accepted"
  | "review_rejected"
  | "subscription_ignored"
  | "aggregator_split" // D6: storefront receipt → per-service subscriptions
  // action signals (§3.3)
  | "cancellation_drafted"
  | "cancellation_sent"
  | "cancellation_confirmed" // the north star
  // health (§3.4)
  | "scan_failed"
  // landing page (conversion brief §11). These are the only events that can
  // fire before sign-in, so they are the only ones recorded against the
  // shared ANON_ACTOR rather than a person — see research.landingEvent.
  // The denominator for every landing ratio. Without it "40 hero clicks"
  // is a number with nothing to divide by, and §11's headline metric —
  // landing view → OAuth start — cannot be computed at all.
  | "landing_view"
  | "hero_cta_clicked"
  | "oauth_started"
  | "oauth_completed"
  | "oauth_failed"
  | "demo_step_viewed"
  | "pricing_viewed"
  | "faq_opened"
  | "final_cta_clicked"
  // The landing assistant (a visitor-facing bot): opened once per view, and
  // one event per visitor message — enough to see whether it earns its spot.
  | "assistant_opened"
  | "assistant_message";

/**
 * The actor id for events from signed-out visitors.
 *
 * Deliberately a single shared constant, not a per-visitor id: measuring the
 * landing funnel needs COUNTS (how many hero clicks per N page views), not
 * individuals. A visitor identifier would be a new tracking cookie, a new
 * disclosure in the privacy policy, and a consent question — for a ratio we
 * can compute without it. Anything recorded under this id is aggregate only
 * and must never be presented as per-user behaviour.
 */
export const ANON_ACTOR = "anon";

/**
 * Record an event. Analytics must never break a user's actual request, so
 * failures are swallowed — a lost data point costs less than a failed scan.
 */
export async function track(
  db: Database,
  userId: string,
  name: AnalyticsEvent,
  value?: number,
): Promise<void> {
  try {
    await db.insert(analyticsEvents).values({ userId, name, value: value ?? null });
  } catch {
    // Intentionally silent: instrumentation is never load-bearing.
  }
}
