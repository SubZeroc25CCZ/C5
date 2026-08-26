import { describe, expect, it } from 'vitest';
import {
  monthlyAmount,
  normalizedMonthly,
  monthlySavings,
  portfolioTotals,
} from '../src/engine/normalize';
import { detectSubscriptions, type Charge } from '../src/engine/recurrence';
import { parseExtraction, AUTO_ACCEPT_CONFIDENCE } from '../src/engine/extraction';

describe('normalize', () => {
  it('normalizes cycles to monthly', () => {
    expect(monthlyAmount(10, 'weekly')).toBeCloseTo(43.3);
    expect(monthlyAmount(12.99, 'monthly')).toBeCloseTo(12.99);
    expect(monthlyAmount(30, 'quarterly')).toBeCloseTo(10);
    expect(monthlyAmount(120, 'yearly')).toBeCloseTo(10);
    expect(monthlyAmount(500, 'one_time')).toBe(0);
  });

  it('applies percent and fixed discounts, cycle-normalized', () => {
    expect(normalizedMonthly(120, 'yearly', { type: 'percent', value: 50 })).toBeCloseTo(5);
    expect(normalizedMonthly(12, 'monthly', { type: 'fixed', value: 2 })).toBeCloseTo(10);
    expect(monthlySavings(120, 'yearly', { type: 'percent', value: 50 })).toBeCloseTo(5);
    expect(monthlySavings(12, 'monthly', { type: 'fixed', value: 2 })).toBeCloseTo(2);
  });

  it('never goes below zero on oversized fixed discounts', () => {
    expect(normalizedMonthly(5, 'monthly', { type: 'fixed', value: 50 })).toBe(0);
  });

  it('computes portfolio totals over active subs only', () => {
    const totals = portfolioTotals([
      { amount: 12.99, cycle: 'monthly', status: 'active' },
      { amount: 120, cycle: 'yearly', status: 'active' },
      { amount: 99, cycle: 'monthly', status: 'cancelled' },
    ]);
    expect(totals.monthly).toBeCloseTo(22.99);
    expect(totals.yearly).toBeCloseTo(275.88);
    expect(totals.activeCount).toBe(2);
  });
});

describe('recurrence engine', () => {
  const monthly = (merchant: string, amounts: number[], startMonth = 0): Charge[] =>
    amounts.map((amount, i) => ({
      merchant,
      amount,
      currency: 'EUR',
      chargedAt: new Date(Date.UTC(2026, startMonth + i, 5)),
    }));

  it('confirms a monthly subscription from 3 regular charges', () => {
    const { confirmed, possible } = detectSubscriptions(
      monthly('Netflix', [11.99, 11.99, 11.99]),
    );
    expect(possible).toHaveLength(0);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].cycle).toBe('monthly');
    expect(confirmed[0].chargeCount).toBe(3);
    expect(confirmed[0].confidence).toBeGreaterThan(0.7);
    expect(confirmed[0].priceChanges).toHaveLength(0);
  });

  it('detects a price increase between cycles', () => {
    const { confirmed } = detectSubscriptions(
      monthly('Netflix', [11.99, 11.99, 13.99]),
    );
    expect(confirmed[0].amount).toBe(13.99);
    expect(confirmed[0].priceChanges).toEqual([
      expect.objectContaining({ oldAmount: 11.99, newAmount: 13.99 }),
    ]);
  });

  it('confirms a yearly subscription', () => {
    const charges: Charge[] = [
      { merchant: 'Adobe', amount: 240, currency: 'USD', chargedAt: new Date(Date.UTC(2024, 5, 1)) },
      { merchant: 'Adobe', amount: 240, currency: 'USD', chargedAt: new Date(Date.UTC(2025, 5, 1)) },
      { merchant: 'Adobe', amount: 264, currency: 'USD', chargedAt: new Date(Date.UTC(2026, 5, 1)) },
    ];
    const { confirmed } = detectSubscriptions(charges);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].cycle).toBe('yearly');
    expect(confirmed[0].priceChanges).toHaveLength(1);
  });

  it('treats a single charge as possible, never confirmed', () => {
    const { confirmed, possible } = detectSubscriptions(
      monthly('Airbnb', [52.4]),
    );
    expect(confirmed).toHaveLength(0);
    expect(possible).toHaveLength(1);
  });

  it('rejects irregular intervals', () => {
    const charges: Charge[] = [
      { merchant: 'Random Shop', amount: 20, currency: 'EUR', chargedAt: new Date(Date.UTC(2026, 0, 1)) },
      { merchant: 'Random Shop', amount: 20, currency: 'EUR', chargedAt: new Date(Date.UTC(2026, 1, 15)) },
    ];
    const { confirmed, possible } = detectSubscriptions(charges);
    expect(confirmed).toHaveLength(0);
    expect(possible).toHaveLength(2);
  });

  it('keeps currencies separate', () => {
    const charges: Charge[] = [
      ...monthly('Spotify', [9.99, 9.99]),
      { merchant: 'Spotify', amount: 10.99, currency: 'USD', chargedAt: new Date(Date.UTC(2026, 0, 20)) },
    ];
    const { confirmed, possible } = detectSubscriptions(charges);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].currency).toBe('EUR');
    expect(possible).toHaveLength(1);
  });
});

describe('extraction contract', () => {
  it('parses a valid model response', () => {
    const parsed = parseExtraction(
      '{"merchant":"Netflix","amount":12.99,"currency":"EUR","chargedAt":"2026-08-01","cycleHint":"monthly","confidence":0.95}',
    );
    expect(parsed?.merchant).toBe('Netflix');
    expect(parsed && parsed.confidence >= AUTO_ACCEPT_CONFIDENCE).toBe(true);
  });

  it('returns null for non-billing emails and malformed output', () => {
    expect(parseExtraction('null')).toBeNull();
    expect(parseExtraction('Sure! Here is the JSON you asked for')).toBeNull();
    expect(parseExtraction('{"merchant":"","amount":-5}')).toBeNull();
  });

  it('strips markdown fences', () => {
    const parsed = parseExtraction(
      '```json\n{"merchant":"Spotify","amount":9.99,"currency":"EUR","chargedAt":"2026-08-02","cycleHint":"monthly","confidence":0.9}\n```',
    );
    expect(parsed?.merchant).toBe('Spotify');
  });
});
