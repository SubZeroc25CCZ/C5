// Teaser-plan redaction (decision D5). Runs AT THE API LAYER: an unpaid
// user's list response contains per-currency totals, counts, and ONE fully
// visible subscription (the most expensive confirmed one, with evidence
// access) — every other row is reduced to a locked placeholder carrying no
// merchant, no amount, no id. What never leaves the server can never be
// un-blurred by the client.

import { normalizedMonthly, type BillingCycle } from "@/engine/normalize";
import { minorToMajor } from "@/lib/money";

interface SubscriptionLikeRow {
  subscription: {
    id: number;
    status: string;
    amountMinor: number;
    currency: string;
    cycle: string;
  };
}

/** A redacted row: enough to render a blurred placeholder, nothing more. */
export interface LockedRow {
  locked: true;
  status: string;
}

function monthlyMajor(row: SubscriptionLikeRow): number {
  return normalizedMonthly(
    minorToMajor(row.subscription.amountMinor, row.subscription.currency),
    row.subscription.cycle as BillingCycle,
  );
}

/**
 * The one subscription a teaser user sees in full: the most expensive
 * confirmed (active) subscription. Currencies are never compared against
 * each other (§10.1), so "most expensive" means: in the currency with the
 * highest confirmed monthly total, the subscription with the highest
 * normalized monthly cost. Returns null when nothing is confirmed.
 */
export function unlockedSubscriptionId(rows: SubscriptionLikeRow[]): number | null {
  const active = rows.filter((row) => row.subscription.status === "active");
  if (active.length === 0) return null;

  const totalsByCurrency = new Map<string, number>();
  for (const row of active) {
    const currency = row.subscription.currency;
    totalsByCurrency.set(currency, (totalsByCurrency.get(currency) ?? 0) + monthlyMajor(row));
  }
  // Tie-breakers keep this deterministic regardless of input row order: two
  // call sites (subscriptions.list, ordered by lastChargeAt; and
  // assertPlanSeesSubscription, unordered) must agree on the same unlocked id.
  const dominantCurrency = [...totalsByCurrency.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  )[0]![0];

  const top = active
    .filter((row) => row.subscription.currency === dominantCurrency)
    .sort(
      (a, b) => monthlyMajor(b) - monthlyMajor(a) || a.subscription.id - b.subscription.id,
    )[0]!;
  return top.subscription.id;
}

export interface TeaserList<Row extends SubscriptionLikeRow, Totals, PriceChange> {
  teaser: true;
  /** Per-currency totals — allowed in the teaser. */
  totals: Totals;
  counts: { total: number; confirmed: number; possible: number };
  /** The single fully visible subscription (with merchant), or null. */
  unlocked: Row | null;
  /** Placeholders for every other row: status only. */
  lockedRows: LockedRow[];
  /** Price changes for the unlocked subscription only. */
  recentPriceChanges: PriceChange[];
}

export function redactListForTeaser<
  Row extends SubscriptionLikeRow,
  Totals,
  PriceChange extends { subscriptionId: number },
>(full: {
  subscriptions: Row[];
  totals: Totals;
  recentPriceChanges: PriceChange[];
}): TeaserList<Row, Totals, PriceChange> {
  const rows = full.subscriptions;
  const unlockedId = unlockedSubscriptionId(rows);
  const unlocked = rows.find((row) => row.subscription.id === unlockedId) ?? null;

  return {
    teaser: true,
    totals: full.totals,
    counts: {
      total: rows.length,
      confirmed: rows.filter((row) => row.subscription.status === "active").length,
      possible: rows.filter((row) => row.subscription.status === "possible").length,
    },
    unlocked,
    lockedRows: rows
      .filter((row) => row.subscription.id !== unlockedId)
      .map((row) => ({ locked: true as const, status: row.subscription.status })),
    recentPriceChanges: full.recentPriceChanges.filter(
      (change) => change.subscriptionId === unlockedId,
    ),
  };
}
