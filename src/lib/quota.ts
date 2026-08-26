// Per-user scan quotas (§8 P0): free = 1 connected inbox, no continuous
// sync; Pro = unlimited inboxes + continuous sync. Screenshot import is a
// secondary capture method and is unmetered in Pro (§4).

export type Plan = "free" | "pro";

export const PLAN_LIMITS: Record<
  Plan,
  { maxConnectedInboxes: number; continuousSync: boolean }
> = {
  free: { maxConnectedInboxes: 1, continuousSync: false },
  pro: { maxConnectedInboxes: Number.POSITIVE_INFINITY, continuousSync: true },
};

export function canConnectInbox(plan: Plan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxConnectedInboxes;
}

export function hasContinuousSync(plan: Plan): boolean {
  return PLAN_LIMITS[plan].continuousSync;
}
