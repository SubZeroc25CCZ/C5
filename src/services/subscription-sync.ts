// Bridges stored charges and the ported v1 recurrence engine: loads a
// user's charges, runs detectSubscriptions, and upserts subscription rows,
// evidence links ("what we saw", §6), and price_change events.

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  charges,
  priceChanges,
  subscriptionEvidence,
  subscriptions,
} from "@/db/schema";
import {
  detectSubscriptions,
  groupKey,
  nextRenewalAt,
  type Charge as EngineCharge,
} from "@/engine/recurrence";
import { majorToMinor, minorToMajor } from "@/lib/money";

export interface SyncResult {
  confirmed: number;
  possible: number;
  priceChangeEvents: number;
}

export async function syncSubscriptionsForUser(
  db: Database,
  userId: string,
): Promise<SyncResult> {
  const rows = await db.select().from(charges).where(eq(charges.userId, userId));

  // Charges flagged needs_review stay out of detection until a human
  // approves them (§5.2 — never silently saved).
  const usable = rows.filter((row) => row.extractionConfidence === null || !rowNeedsReview(row));

  const engineCharges: EngineCharge[] = usable.map((row) => ({
    merchant: row.merchantName,
    amount: minorToMajor(row.amountMinor, row.currency),
    currency: row.currency,
    chargedAt: row.chargedAt,
  }));

  const { confirmed, possible } = detectSubscriptions(engineCharges);

  const chargeIdsByGroup = new Map<string, number[]>();
  const merchantIdByGroup = new Map<string, number | null>();
  for (const row of usable) {
    const key = groupKey({
      merchant: row.merchantName,
      amount: 0,
      currency: row.currency,
      chargedAt: row.chargedAt,
    });
    const list = chargeIdsByGroup.get(key);
    if (list) list.push(row.id);
    else chargeIdsByGroup.set(key, [row.id]);
    if (row.merchantId != null) merchantIdByGroup.set(key, row.merchantId);
  }

  let priceChangeEvents = 0;

  for (const detected of confirmed) {
    const key = `${detected.merchant.toLowerCase().trim()}|${detected.currency}`;
    const amountMinor = majorToMinor(detected.amount, detected.currency);

    const existing = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.name, detected.merchant),
          eq(subscriptions.currency, detected.currency),
        ),
      )
      .limit(1);

    let subscriptionId: number;
    const values = {
      merchantId: merchantIdByGroup.get(key) ?? null,
      amountMinor,
      cycle: detected.cycle,
      confidence: Math.round(detected.confidence * 100),
      lastChargeAt: detected.lastChargedAt,
      nextRenewalAt: nextRenewalAt(detected.cycle, detected.lastChargedAt),
    };

    if (existing[0]) {
      subscriptionId = existing[0].id;
      // A user decision (ignored / cancellation flow) outranks re-detection.
      const overridden = ["ignored", "cancellation_requested", "cancelled"].includes(
        existing[0].status,
      );
      await db
        .update(subscriptions)
        .set(overridden ? values : { ...values, status: "active" })
        .where(eq(subscriptions.id, subscriptionId));
    } else {
      const inserted = await db
        .insert(subscriptions)
        .values({
          userId,
          name: detected.merchant,
          currency: detected.currency,
          status: "active",
          detectedFrom: "email",
          firstChargeAt: detected.priceChanges[0]?.observedAt ?? detected.lastChargedAt,
          ...values,
        })
        .returning({ id: subscriptions.id });
      subscriptionId = inserted[0]!.id;
    }

    // Evidence links — the "what we saw" log (§6).
    const evidenceIds = chargeIdsByGroup.get(key) ?? [];
    if (evidenceIds.length > 0) {
      await db
        .insert(subscriptionEvidence)
        .values(evidenceIds.map((chargeId) => ({ subscriptionId, chargeId })))
        .onConflictDoNothing();
    }

    // Price changes: insert only ones not already recorded (by observedAt).
    if (detected.priceChanges.length > 0) {
      const known = await db
        .select({ observedAt: priceChanges.observedAt })
        .from(priceChanges)
        .where(eq(priceChanges.subscriptionId, subscriptionId));
      const knownTimes = new Set(known.map((k) => k.observedAt.getTime()));
      for (const change of detected.priceChanges) {
        if (knownTimes.has(change.observedAt.getTime())) continue;
        await db.insert(priceChanges).values({
          subscriptionId,
          oldAmountMinor: majorToMinor(change.oldAmount, detected.currency),
          newAmountMinor: majorToMinor(change.newAmount, detected.currency),
          currency: detected.currency,
          observedAt: change.observedAt,
        });
        priceChangeEvents += 1;
      }
    }
  }

  // Single sightings: "possible subscription", shown separately (§5.3).
  const possibleKeys = new Set(possible.map((charge) => groupKey(charge)));
  let possibleCount = 0;
  for (const charge of possible) {
    const key = groupKey(charge);
    const existing = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.name, charge.merchant),
          eq(subscriptions.currency, charge.currency.toUpperCase()),
        ),
      )
      .limit(1);
    if (existing[0]) continue;
    const inserted = await db
      .insert(subscriptions)
      .values({
        userId,
        name: charge.merchant,
        merchantId: merchantIdByGroup.get(key) ?? null,
        amountMinor: majorToMinor(charge.amount, charge.currency),
        currency: charge.currency.toUpperCase(),
        cycle: "monthly", // display placeholder; status "possible" gates all math
        status: "possible",
        detectedFrom: "email",
        firstChargeAt: charge.chargedAt,
        lastChargeAt: charge.chargedAt,
      })
      .returning({ id: subscriptions.id });
    const evidenceIds = chargeIdsByGroup.get(key) ?? [];
    if (evidenceIds.length > 0) {
      await db
        .insert(subscriptionEvidence)
        .values(
          evidenceIds.map((chargeId) => ({
            subscriptionId: inserted[0]!.id,
            chargeId,
          })),
        )
        .onConflictDoNothing();
    }
    possibleCount += 1;
  }
  void possibleKeys;

  return { confirmed: confirmed.length, possible: possibleCount, priceChangeEvents };
}

function rowNeedsReview(row: {
  extractionConfidence: number | null;
  reviewedAt: Date | null;
}): boolean {
  // Stage 2 rows below the auto-accept threshold (0.8 → 80) wait for review
  // (§5.2) — unless a human has approved them.
  return (
    row.extractionConfidence !== null && row.extractionConfidence < 80 && row.reviewedAt === null
  );
}

export async function deleteDerivedDataForUser(db: Database, userId: string): Promise<void> {
  // One-click revoke also deletes derived data on request (§6).
  const subs = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  const subIds = subs.map((s) => s.id);
  if (subIds.length > 0) {
    await db.delete(subscriptionEvidence).where(inArray(subscriptionEvidence.subscriptionId, subIds));
    await db.delete(priceChanges).where(inArray(priceChanges.subscriptionId, subIds));
  }
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
  await db.delete(charges).where(eq(charges.userId, userId));
}
