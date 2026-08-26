/**
 * SubZero v2 — recurrence engine.
 * Input: charges extracted from email receipts.
 * Output: confirmed subscriptions (≥2 matching charges at a regular interval),
 * possible subscriptions (single sightings — shown separately, never merged),
 * and observed price changes.
 * Honesty rule: one charge is evidence, not a subscription.
 */

export interface Charge {
  merchant: string;
  amount: number;
  currency: string;
  chargedAt: Date;
}

export type DetectedCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PriceChange {
  oldAmount: number;
  newAmount: number;
  observedAt: Date;
}

export interface DetectedSubscription {
  merchant: string;
  currency: string;
  amount: number; // most recent observed amount
  cycle: DetectedCycle;
  confidence: number; // 0..1 — grows with charge count and interval consistency
  chargeCount: number;
  lastChargedAt: Date;
  priceChanges: PriceChange[];
}

interface CycleDef {
  cycle: DetectedCycle;
  days: number;
  toleranceDays: number;
}

const CYCLES: CycleDef[] = [
  { cycle: 'weekly', days: 7, toleranceDays: 2 },
  { cycle: 'monthly', days: 30.44, toleranceDays: 4 },
  { cycle: 'quarterly', days: 91.31, toleranceDays: 7 },
  { cycle: 'yearly', days: 365.25, toleranceDays: 14 },
];

const MS_PER_DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / MS_PER_DAY;
}

export function groupKey(c: Charge): string {
  return `${c.merchant.toLowerCase().trim()}|${c.currency.toUpperCase()}`;
}

/** v2 addition: projected next renewal from the last observed charge.
 *  A projection from observed cadence, labeled as such in the UI — never a fabricated charge. */
export function nextRenewalAt(cycle: DetectedCycle, lastChargedAt: Date): Date {
  const def = CYCLES.find((c) => c.cycle === cycle)!;
  return new Date(lastChargedAt.getTime() + Math.round(def.days * MS_PER_DAY));
}

export function detectSubscriptions(charges: Charge[]): {
  confirmed: DetectedSubscription[];
  possible: Charge[];
} {
  const groups = new Map<string, Charge[]>();
  for (const c of charges) {
    const key = groupKey(c);
    const g = groups.get(key);
    if (g) g.push(c);
    else groups.set(key, [c]);
  }

  const confirmed: DetectedSubscription[] = [];
  const possible: Charge[] = [];

  for (const group of groups.values()) {
    group.sort((a, b) => a.chargedAt.getTime() - b.chargedAt.getTime());

    if (group.length < 2) {
      possible.push(...group);
      continue;
    }

    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) {
      intervals.push(daysBetween(group[i - 1].chargedAt, group[i].chargedAt));
    }
    const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length;

    const match = CYCLES.find(
      (c) => Math.abs(avgInterval - c.days) <= c.toleranceDays,
    );
    if (!match) {
      possible.push(...group);
      continue;
    }

    const withinTolerance =
      intervals.filter((iv) => Math.abs(iv - match.days) <= match.toleranceDays)
        .length / intervals.length;

    const priceChanges: PriceChange[] = [];
    for (let i = 1; i < group.length; i++) {
      if (group[i].amount !== group[i - 1].amount) {
        priceChanges.push({
          oldAmount: group[i - 1].amount,
          newAmount: group[i].amount,
          observedAt: group[i].chargedAt,
        });
      }
    }

    const last = group[group.length - 1];
    confirmed.push({
      merchant: last.merchant,
      currency: last.currency.toUpperCase(),
      amount: last.amount,
      cycle: match.cycle,
      confidence: Math.min(1, 0.5 + 0.15 * (group.length - 1)) * withinTolerance,
      chargeCount: group.length,
      lastChargedAt: last.chargedAt,
      priceChanges,
    });
  }

  return { confirmed, possible };
}
