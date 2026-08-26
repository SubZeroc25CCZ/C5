/**
 * SubZero v2 — normalization module.
 * THE single source of truth for money math. Every surface (dashboard,
 * analytics, exports) imports from here. No duplicate calculators.
 * Rule: never output a number that wasn't observed or derived from observed data.
 */

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time';

export interface Discount {
  type: 'percent' | 'fixed';
  value: number;
}

const WEEKS_PER_MONTH = 4.33;

/** Convert a charge at a given cycle into its effective monthly cost. */
export function monthlyAmount(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':
      return amount * WEEKS_PER_MONTH;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    case 'one_time':
      return 0;
  }
}

/** Apply a discount to a raw per-cycle amount. Never returns below zero. */
export function applyDiscount(amount: number, discount?: Discount | null): number {
  if (!discount) return amount;
  if (discount.type === 'percent') {
    return Math.max(0, amount * (1 - discount.value / 100));
  }
  return Math.max(0, amount - discount.value);
}

/** Effective monthly cost after discount — the headline number. */
export function normalizedMonthly(
  amount: number,
  cycle: BillingCycle,
  discount?: Discount | null,
): number {
  return monthlyAmount(applyDiscount(amount, discount), cycle);
}

/** Cycle-normalized monthly savings from a discount (v1 bug fix: both
 *  percent AND fixed discounts, normalized to monthly, everywhere). */
export function monthlySavings(
  amount: number,
  cycle: BillingCycle,
  discount?: Discount | null,
): number {
  return monthlyAmount(amount, cycle) - normalizedMonthly(amount, cycle, discount);
}

export interface SubscriptionLike {
  amount: number;
  cycle: BillingCycle;
  discount?: Discount | null;
  status: string;
}

/** Portfolio totals over active subscriptions only. */
export function portfolioTotals(subs: SubscriptionLike[]) {
  const active = subs.filter((s) => s.status === 'active');
  const monthly = active.reduce((sum, s) => sum + normalizedMonthly(s.amount, s.cycle, s.discount), 0);
  const savings = active.reduce((sum, s) => sum + monthlySavings(s.amount, s.cycle, s.discount), 0);
  return {
    monthly: round2(monthly),
    yearly: round2(monthly * 12),
    monthlySavings: round2(savings),
    activeCount: active.length,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// v2 additions (§ Goals 4 — multi-currency). Same calculator, per-currency
// buckets: an FX rate is a number the system didn't observe (§10.1), so
// totals are reported per currency, never merged into one synthetic figure.

export interface CurrencySubscriptionLike extends SubscriptionLike {
  currency: string;
  category?: string;
}

export interface CurrencyTotals {
  currency: string;
  monthly: number;
  yearly: number;
  activeCount: number;
  byCategory: Record<string, number>; // normalized monthly per category
}

export function portfolioTotalsByCurrency(subs: CurrencySubscriptionLike[]): CurrencyTotals[] {
  const buckets = new Map<string, CurrencySubscriptionLike[]>();
  for (const sub of subs) {
    const code = sub.currency.toUpperCase();
    const bucket = buckets.get(code);
    if (bucket) bucket.push(sub);
    else buckets.set(code, [sub]);
  }
  const out: CurrencyTotals[] = [];
  for (const [currency, bucket] of buckets) {
    const totals = portfolioTotals(bucket);
    const byCategory: Record<string, number> = {};
    for (const sub of bucket) {
      if (sub.status !== 'active') continue;
      const category = sub.category ?? 'uncategorized';
      byCategory[category] = round2(
        (byCategory[category] ?? 0) + normalizedMonthly(sub.amount, sub.cycle, sub.discount),
      );
    }
    out.push({
      currency,
      monthly: totals.monthly,
      yearly: totals.yearly,
      activeCount: totals.activeCount,
      byCategory,
    });
  }
  return out.sort((a, b) => a.currency.localeCompare(b.currency));
}
