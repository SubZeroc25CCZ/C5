// Demo scan for the design-preview harness (/dev/preview, development only).
//
// This is NOT hand-drawn data: the synthetic receipts below are pushed
// through the same code paths a real inbox goes through — Stage 1 merchant
// matching against the real 400+ merchant seed, the recurrence engine to
// EARN each cycle and status from actual charge dates, and the shared
// portfolio calculator for the totals. If the pipeline wouldn't claim it,
// the screenshot can't show it. The one thing skipped is Gmail itself.

import { MerchantMatcher } from "@/ingestion/stage1-matcher";
import { seedAsRecords } from "@/merchants/seed";
import { detectSubscriptions, nextRenewalAt, type Charge } from "@/engine/recurrence";
import { portfolioTotalsByCurrency } from "@/engine/normalize";
import { isAggregatorMerchant } from "@/lib/aggregators";
import { customerMerchant } from "@/server/merchant-view";
import { majorToMinor, minorToMajor } from "@/lib/money";
import type { FullListPayload } from "@/app/dashboard/dashboard-client";

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * DAY);

/** A synthetic receipt: real From-headers so Stage 1 does the matching. */
interface DemoReceipt {
  from: string;
  amount: number; // major units
  currency: string;
  chargedAtDaysAgo: number;
}

// Monthly cadences drift a day or two like real billing does — the
// recurrence engine's tolerance windows are part of what's being exercised.
const RECEIPTS: DemoReceipt[] = [
  // Netflix — 5 monthly charges → confirmed monthly.
  { from: "Netflix <info@account.netflix.com>", amount: 17.99, currency: "USD", chargedAtDaysAgo: 128 },
  { from: "Netflix <info@account.netflix.com>", amount: 17.99, currency: "USD", chargedAtDaysAgo: 97 },
  { from: "Netflix <info@account.netflix.com>", amount: 17.99, currency: "USD", chargedAtDaysAgo: 67 },
  { from: "Netflix <info@account.netflix.com>", amount: 17.99, currency: "USD", chargedAtDaysAgo: 36 },
  { from: "Netflix <info@account.netflix.com>", amount: 17.99, currency: "USD", chargedAtDaysAgo: 6 },
  // Spotify — monthly with a real price increase two charges ago.
  { from: "Spotify <no-reply@spotify.com>", amount: 10.99, currency: "USD", chargedAtDaysAgo: 133 },
  { from: "Spotify <no-reply@spotify.com>", amount: 10.99, currency: "USD", chargedAtDaysAgo: 102 },
  { from: "Spotify <no-reply@spotify.com>", amount: 11.99, currency: "USD", chargedAtDaysAgo: 72 },
  { from: "Spotify <no-reply@spotify.com>", amount: 11.99, currency: "USD", chargedAtDaysAgo: 41 },
  { from: "Spotify <no-reply@spotify.com>", amount: 11.99, currency: "USD", chargedAtDaysAgo: 11 },
  // Dropbox — 3 monthly charges.
  { from: "Dropbox <no-reply@dropbox.com>", amount: 11.99, currency: "USD", chargedAtDaysAgo: 75 },
  { from: "Dropbox <no-reply@dropbox.com>", amount: 11.99, currency: "USD", chargedAtDaysAgo: 44 },
  { from: "Dropbox <no-reply@dropbox.com>", amount: 11.99, currency: "USD", chargedAtDaysAgo: 14 },
  // Audible — seen once. Stays "possible": one charge is evidence, not a
  // subscription (§10), and the screenshot must show that honesty.
  { from: "Audible <donotreply@audible.com>", amount: 14.95, currency: "USD", chargedAtDaysAgo: 19 },
];

// Apple storefront receipts (D6): amounts vary because the basket varies, so
// this renders as observed spend, never a monthly price. Stage 1 refuses
// apple.com by design (ambiguous conglomerate domain — Stage 2's job), so the
// storefront group is named directly, as Stage 2 would.
const APPLE_RECEIPTS = [
  { amount: 9.99, chargedAtDaysAgo: 63 },
  { amount: 2.99, chargedAtDaysAgo: 47 },
  { amount: 12.99, chargedAtDaysAgo: 33 },
  { amount: 2.99, chargedAtDaysAgo: 9 },
];

function buildList(): FullListPayload {
  const matcher = new MerchantMatcher(seedAsRecords());

  // Stage 1: resolve each receipt's sender to a seed merchant.
  const charges: (Charge & { merchantRecordName: string })[] = RECEIPTS.map((receipt) => {
    const merchant = matcher.match(receipt.from);
    if (!merchant) throw new Error(`Demo receipt sender did not match the seed: ${receipt.from}`);
    return {
      merchant: merchant.name,
      merchantRecordName: merchant.name,
      amount: receipt.amount,
      currency: receipt.currency,
      chargedAt: daysAgo(receipt.chargedAtDaysAgo),
    };
  });

  // Recurrence engine: cycles and statuses are detected, not asserted.
  const { confirmed, possible } = detectSubscriptions(charges);

  const seedByName = new Map(seedAsRecords().map((record) => [record.name, record]));
  const merchantRow = (name: string) => {
    const seed = seedByName.get(name);
    if (!seed) return null;
    return customerMerchant({
      id: seed.id,
      name: seed.name,
      slug: seed.slug,
      // Empty on purpose: MerchantLogo fetches favicons by domain from the
      // network, which a headless screenshot run can't rely on. No domain
      // renders the product's own deterministic letter tile instead.
      domains: [] as string[],
      category: seed.category,
      logoUrl: null,
      cancelUrl: seed.cancelUrl,
      cancelMethod: seed.cancelMethod,
      cancelEmail: seed.cancelEmail ?? null,
      difficulty: seed.difficulty,
      cancelUrlVerifiedAt: null,
      cancelUrlVerifiedBy: null,
      cancelUrlSource: null,
      createdAt: daysAgo(200),
    });
  };

  let nextId = 1;
  const subscriptions: FullListPayload["subscriptions"] = [];

  const subRowBase = {
    userId: "demo",
    detectedFrom: "email" as const,
    createdAt: daysAgo(130),
    updatedAt: daysAgo(1),
  };

  for (const sub of confirmed) {
    const own = charges.filter(
      (charge) => charge.merchant === sub.merchant && charge.currency === sub.currency,
    );
    const first = own[0];
    subscriptions.push({
      subscription: {
        ...subRowBase,
        id: nextId++,
        merchantId: seedByName.get(sub.merchant)?.id ?? null,
        name: sub.merchant,
        amountMinor: majorToMinor(sub.amount, sub.currency),
        currency: sub.currency,
        cycle: sub.cycle,
        status: "active",
        confidence: Math.round(sub.confidence * 100),
        firstChargeAt: first.chargedAt,
        lastChargeAt: sub.lastChargedAt,
        nextRenewalAt: nextRenewalAt(sub.cycle, sub.lastChargedAt),
      },
      merchant: merchantRow(sub.merchant),
      evidenceCount: sub.chargeCount,
      observedTotalMinor: own.reduce(
        (total, charge) => total + majorToMinor(charge.amount, charge.currency),
        0,
      ),
      aggregator: false,
    });
  }

  for (const charge of possible) {
    subscriptions.push({
      subscription: {
        ...subRowBase,
        id: nextId++,
        merchantId: seedByName.get(charge.merchant)?.id ?? null,
        name: charge.merchant,
        amountMinor: majorToMinor(charge.amount, charge.currency),
        currency: charge.currency,
        cycle: "monthly", // stored hint; the UI never renders a cycle for "possible"
        status: "possible",
        confidence: null,
        firstChargeAt: charge.chargedAt,
        lastChargeAt: charge.chargedAt,
        nextRenewalAt: null,
      },
      merchant: merchantRow(charge.merchant),
      evidenceCount: 1,
      observedTotalMinor: majorToMinor(charge.amount, charge.currency),
      aggregator: false,
    });
  }

  // Apple storefront group (D6).
  const appleObserved = APPLE_RECEIPTS.reduce(
    (total, receipt) => total + majorToMinor(receipt.amount, "USD"),
    0,
  );
  const appleLast = APPLE_RECEIPTS.reduce(
    (last, receipt) => Math.min(last, receipt.chargedAtDaysAgo),
    Infinity,
  );
  if (!isAggregatorMerchant("Apple")) throw new Error("Apple must be an aggregator");
  subscriptions.push({
    subscription: {
      ...subRowBase,
      id: nextId++,
      merchantId: seedByName.get("Apple")?.id ?? null,
      name: "Apple",
      amountMinor: majorToMinor(APPLE_RECEIPTS.at(-1)!.amount, "USD"),
      currency: "USD",
      cycle: "monthly",
      status: "active",
      confidence: null,
      firstChargeAt: daysAgo(Math.max(...APPLE_RECEIPTS.map((receipt) => receipt.chargedAtDaysAgo))),
      lastChargeAt: daysAgo(appleLast),
      nextRenewalAt: null,
    },
    merchant: merchantRow("Apple"),
    evidenceCount: APPLE_RECEIPTS.length,
    observedTotalMinor: appleObserved,
    aggregator: true,
  });

  // Same totals calculator as production: active, non-aggregator only.
  const totals = portfolioTotalsByCurrency(
    subscriptions
      .filter((row) => row.subscription.status === "active" && !row.aggregator)
      .map((row) => ({
        amount: minorToMajor(row.subscription.amountMinor, row.subscription.currency),
        cycle: row.subscription.cycle,
        status: "active",
        currency: row.subscription.currency,
        category: row.merchant?.category,
      })),
  );

  // Price changes exactly as the engine observed them.
  const recentPriceChanges: FullListPayload["recentPriceChanges"] = [];
  let changeId = 1;
  for (const sub of confirmed) {
    const row = subscriptions.find(
      (entry) => entry.subscription.name === sub.merchant && !entry.aggregator,
    );
    if (!row) continue;
    for (const change of sub.priceChanges) {
      recentPriceChanges.push({
        id: changeId++,
        subscriptionId: row.subscription.id,
        oldAmountMinor: majorToMinor(change.oldAmount, sub.currency),
        newAmountMinor: majorToMinor(change.newAmount, sub.currency),
        currency: sub.currency,
        observedAt: change.observedAt,
        userNotifiedAt: null,
        createdAt: change.observedAt,
      });
    }
  }

  return {
    teaser: false,
    subscriptions,
    totals,
    recentPriceChanges,
    counts: {
      total: subscriptions.length,
      confirmed: subscriptions.filter((row) => row.subscription.status === "active").length,
      possible: subscriptions.filter((row) => row.subscription.status === "possible").length,
    },
  };
}

// Landing-page rule (conversion brief): no real company names in marketing
// visuals. The pipeline ran against real senders so the matching is genuine;
// the names are pseudonymized only at display time — amounts, cycles,
// statuses, and categories stay exactly as detected.
const DISPLAY_ALIAS: Record<string, string> = {
  Netflix: "Stream Plus",
  Spotify: "Tune Box",
  Dropbox: "Cloud Box",
  Audible: "Listenly",
  Apple: "Appmarket",
};

function anonymize(list: FullListPayload): FullListPayload {
  return {
    ...list,
    subscriptions: list.subscriptions.map((row) => ({
      ...row,
      subscription: {
        ...row.subscription,
        name: DISPLAY_ALIAS[row.subscription.name] ?? row.subscription.name,
      },
      merchant: row.merchant
        ? { ...row.merchant, name: DISPLAY_ALIAS[row.merchant.name] ?? row.merchant.name }
        : null,
    })),
  };
}

export const demoList = anonymize(buildList());

export const demoAccounts = [
  {
    id: 1,
    provider: "gmail" as const,
    address: "demo@example.com",
    status: "active" as const,
    lastSyncedAt: daysAgo(0.05),
  },
];

/**
 * Detail payload for /dev/preview/subscription: the price-changed
 * subscription with its full evidence timeline, in the shape
 * subscriptions.get returns. Evidence is rebuilt from the same receipts the
 * pipeline detected it from, pseudonymized the same way.
 */
export function demoDetail() {
  const row = demoList.subscriptions.find(
    (entry) => entry.subscription.name === "Tune Box",
  );
  if (!row) throw new Error("Tune Box missing from the demo scan");
  const receipts = RECEIPTS.filter((receipt) => receipt.from.startsWith("Spotify"));
  const evidence = receipts
    .map((receipt, index) => ({
      id: 100 + index,
      userId: "demo",
      merchantId: row.subscription.merchantId,
      merchantName: "Tune Box",
      amountMinor: majorToMinor(receipt.amount, receipt.currency),
      currency: receipt.currency,
      chargedAt: daysAgo(receipt.chargedAtDaysAgo),
      sourceMessageRef: `demo-msg-${index}`,
      sourceSubject: `Your Tune Box receipt — $${receipt.amount.toFixed(2)}`,
      extractionConfidence: null,
      reviewedAt: null,
      detectedFrom: "email" as const,
      createdAt: daysAgo(receipt.chargedAtDaysAgo),
    }))
    .sort((a, b) => b.chargedAt.getTime() - a.chargedAt.getTime());
  return {
    subscription: row.subscription,
    merchant: row.merchant,
    evidence,
    priceChanges: demoList.recentPriceChanges.filter(
      (change) => change.subscriptionId === row.subscription.id,
    ),
    cancellationRequests: [],
  };
}

// The zero-results payload: same shape, nothing found. Paired with a synced
// account it renders "an empty result is a real result"; with no account it
// renders the first-visit state.
export const emptyList: FullListPayload = {
  teaser: false,
  subscriptions: [],
  totals: [],
  recentPriceChanges: [],
  counts: { total: 0, confirmed: 0, possible: 0 },
};
