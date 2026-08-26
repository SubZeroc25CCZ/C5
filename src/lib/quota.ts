// Per-user scan quotas (§8 P0, decision D2): free = 1 connected inbox with a
// monthly re-scan; Pro = unlimited inboxes + daily continuous sync.
// Screenshot import is a secondary capture method and is unmetered in Pro (§4).

export type Plan = "free" | "pro";

export const PLAN_LIMITS: Record<
  Plan,
  { maxConnectedInboxes: number; syncIntervalDays: number }
> = {
  free: { maxConnectedInboxes: 1, syncIntervalDays: 30 },
  pro: { maxConnectedInboxes: Number.POSITIVE_INFINITY, syncIntervalDays: 1 },
};

const DAY_MS = 86_400_000;

export function canConnectInbox(plan: Plan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxConnectedInboxes;
}

/** Daily continuous sync is the Pro cadence. */
export function hasContinuousSync(plan: Plan): boolean {
  return PLAN_LIMITS[plan].syncIntervalDays <= 1;
}

/** Whether an account is due for a re-scan under its plan's cadence. */
export function scanDue(plan: Plan, lastSyncedAt: Date | null, now = new Date()): boolean {
  if (!lastSyncedAt) return true;
  return now.getTime() - lastSyncedAt.getTime() >= PLAN_LIMITS[plan].syncIntervalDays * DAY_MS;
}

/** The earliest moment the next re-scan unlocks (for UI/error copy). */
export function nextScanAt(plan: Plan, lastSyncedAt: Date | null): Date | null {
  if (!lastSyncedAt) return null;
  return new Date(lastSyncedAt.getTime() + PLAN_LIMITS[plan].syncIntervalDays * DAY_MS);
}
