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
  | "scan_failed";

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
