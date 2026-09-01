// Per-user access gates (§8 P0, decision D11 — supersedes D5's tiers).
//
// The pivot: SubZero no longer sells a monthly subscription to a product
// whose job is killing subscriptions. Access comes in three shapes:
//
// free      (post-scan): redacted results only — per-currency totals, counts,
//           and the single most expensive confirmed subscription. No re-scan,
//           no cancellation tools.
// pass      Cleanup Pass — a ONE-TIME purchase that grants full access for 30
//           days: everything unlocked, all cancellation tools, re-scan daily.
//           It expires; it never renews itself.
// guardian  the annual watch plan (Stripe subscription): full access,
//           monthly automatic re-scan, price-increase + renewal alerts.
//
// Legacy "basic"/"pro" rows (pre-pivot, never sold again) resolve to
// guardian-level access — grandfathering costs nothing and breaks nobody.

export type Access = "free" | "pass" | "guardian";

/**
 * Resolve stored billing state to effective access. The pass boundary is
 * strict: at the exact expiry instant, access is already gone — we told the
 * buyer "30 days," and the product's honesty rules apply to its own billing.
 */
export function resolveAccess(
  rawPlan: string | null | undefined,
  passExpiresAt: Date | null | undefined,
  now = new Date(),
): Access {
  if (rawPlan === "guardian" || rawPlan === "basic" || rawPlan === "pro") return "guardian";
  if (passExpiresAt && passExpiresAt.getTime() > now.getTime()) return "pass";
  return "free";
}

export interface AccessLimits {
  maxConnectedInboxes: number;
  /** Re-scan cadence in days; null = re-scans are not part of the tier. */
  syncIntervalDays: number | null;
  /** Full (unredacted) results — false means the API serves the teaser view. */
  fullResults: boolean;
  /** Cancellation drafts, tracking, and the cancellation center. */
  cancellation: boolean;
  /** Renewal + price-increase alerts. */
  alerts: boolean;
}

export const ACCESS_LIMITS: Record<Access, AccessLimits> = {
  free: {
    maxConnectedInboxes: 1,
    syncIntervalDays: null,
    fullResults: false,
    cancellation: false,
    alerts: false,
  },
  pass: {
    maxConnectedInboxes: 3,
    syncIntervalDays: 1,
    fullResults: true,
    cancellation: true,
    alerts: true,
  },
  guardian: {
    maxConnectedInboxes: 3,
    syncIntervalDays: 30,
    fullResults: true,
    cancellation: true,
    alerts: true,
  },
};

const DAY_MS = 86_400_000;

export function canConnectInbox(access: Access, currentCount: number): boolean {
  return currentCount < ACCESS_LIMITS[access].maxConnectedInboxes;
}

/** Daily continuous sync — the Cleanup Pass cadence while it is active. */
export function hasContinuousSync(access: Access): boolean {
  const interval = ACCESS_LIMITS[access].syncIntervalDays;
  return interval !== null && interval <= 1;
}

/** Whether an account is due for a re-scan under its access tier's cadence. */
export function scanDue(access: Access, lastSyncedAt: Date | null, now = new Date()): boolean {
  if (!lastSyncedAt) return true; // the initial scan is always allowed
  const interval = ACCESS_LIMITS[access].syncIntervalDays;
  if (interval === null) return false; // free: no re-scans, ever
  return now.getTime() - lastSyncedAt.getTime() >= interval * DAY_MS;
}

/** The earliest moment the next re-scan unlocks (for UI/error copy). */
export function nextScanAt(access: Access, lastSyncedAt: Date | null): Date | null {
  if (!lastSyncedAt) return null;
  const interval = ACCESS_LIMITS[access].syncIntervalDays;
  if (interval === null) return null; // free: never — the Pass is the unlock
  return new Date(lastSyncedAt.getTime() + interval * DAY_MS);
}
