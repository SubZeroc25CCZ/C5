// Per-user plan gates (§8 P0, decision D5 — supersedes D2).
// teaser (unpaid, post-scan): redacted results only — per-currency totals,
//   counts, and the single most expensive confirmed subscription. No re-scan,
//   no cancellation features, no export.
// basic: full results, 1 inbox, 30-day re-scan cadence, evidence, price
//   history, cancellation drafts + tracking.
// pro: Basic + unlimited inboxes, daily sync, renewal/price-increase alerts.

export type Plan = "teaser" | "basic" | "pro";

/** Normalize a stored plan value; legacy "free" rows are the teaser tier. */
export function asPlan(raw: string | null | undefined): Plan {
  if (raw === "basic" || raw === "pro") return raw;
  return "teaser";
}

export interface PlanLimits {
  maxConnectedInboxes: number;
  /** Re-scan cadence in days; null = re-scans are not part of the plan. */
  syncIntervalDays: number | null;
  /** Full (unredacted) results — false means the API serves the teaser view. */
  fullResults: boolean;
  /** Cancellation drafts, tracking, and the cancellation center. */
  cancellation: boolean;
  /** Renewal + price-increase alerts. */
  alerts: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  teaser: {
    maxConnectedInboxes: 1,
    syncIntervalDays: null,
    fullResults: false,
    cancellation: false,
    alerts: false,
  },
  basic: {
    maxConnectedInboxes: 1,
    syncIntervalDays: 30,
    fullResults: true,
    cancellation: true,
    alerts: false,
  },
  pro: {
    maxConnectedInboxes: Number.POSITIVE_INFINITY,
    syncIntervalDays: 1,
    fullResults: true,
    cancellation: true,
    alerts: true,
  },
};

const DAY_MS = 86_400_000;

export function canConnectInbox(plan: Plan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxConnectedInboxes;
}

/** Daily continuous sync is the Pro cadence. */
export function hasContinuousSync(plan: Plan): boolean {
  const interval = PLAN_LIMITS[plan].syncIntervalDays;
  return interval !== null && interval <= 1;
}

/** Whether an account is due for a re-scan under its plan's cadence. */
export function scanDue(plan: Plan, lastSyncedAt: Date | null, now = new Date()): boolean {
  if (!lastSyncedAt) return true; // the initial scan is always allowed
  const interval = PLAN_LIMITS[plan].syncIntervalDays;
  if (interval === null) return false; // teaser: no re-scans, ever
  return now.getTime() - lastSyncedAt.getTime() >= interval * DAY_MS;
}

/** The earliest moment the next re-scan unlocks (for UI/error copy). */
export function nextScanAt(plan: Plan, lastSyncedAt: Date | null): Date | null {
  if (!lastSyncedAt) return null;
  const interval = PLAN_LIMITS[plan].syncIntervalDays;
  if (interval === null) return null; // teaser: never — upgrading is the unlock
  return new Date(lastSyncedAt.getTime() + interval * DAY_MS);
}
