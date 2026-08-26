import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// Carried from SubZero v1 (Clerk IDs replace Manus IDs), hosted on
// Cloudflare D1 (SQLite). The v1 `email_tokens` table is intentionally
// gone — OAuth refresh tokens live encrypted on `email_accounts` and
// nowhere else (§6, §7).

const now = sql`(unixepoch() * 1000)`;

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).default(now).notNull();

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .default(now)
    .$onUpdate(() => new Date())
    .notNull();

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // Clerk user ID
    email: text("email").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  plan: text("plan", { enum: ["free", "pro"] }).default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const emailAccounts = sqliteTable(
  "email_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    provider: text("provider", { enum: ["gmail", "outlook", "agentmail"] }).notNull(),
    address: text("address").notNull(),
    // AES-256-GCM ciphertext (per-user derived key). NEVER a plaintext token.
    encryptedRefreshToken: text("encrypted_refresh_token"),
    syncCursor: text("sync_cursor"), // Gmail historyId / delta cursor
    status: text("status", { enum: ["active", "revoked", "error"] })
      .default("active")
      .notNull(),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("email_accounts_user_idx").on(t.userId),
    uniqueIndex("email_accounts_user_address_idx").on(t.userId, t.address),
  ],
);

export const merchants = sqliteTable(
  "merchants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(), // canonical name
    slug: text("slug").notNull(),
    domains: text("domains", { mode: "json" }).$type<string[]>().notNull(),
    category: text("category").notNull(),
    logoUrl: text("logo_url"),
    cancelUrl: text("cancel_url"),
    cancelMethod: text("cancel_method", { enum: ["url", "email", "phone", "unknown"] })
      .default("unknown")
      .notNull(),
    cancelEmail: text("cancel_email"),
    difficulty: integer("difficulty").default(3).notNull(), // 1 (easy) – 5 (hostile)
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("merchants_slug_idx").on(t.slug)],
);

export const charges = sqliteTable(
  "charges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    merchantId: integer("merchant_id"),
    merchantName: text("merchant_name").notNull(), // as observed
    amountMinor: integer("amount_minor").notNull(), // minor units (cents)
    currency: text("currency").notNull(),
    chargedAt: integer("charged_at", { mode: "timestamp_ms" }).notNull(),
    // Reference only — message id + date + subject. Never the body (§6).
    sourceMessageRef: text("source_message_ref"),
    sourceSubject: text("source_subject"),
    extractionConfidence: integer("extraction_confidence"), // 0–100; null = Stage 1 deterministic match
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }), // user approved a below-threshold extraction
    detectedFrom: text("detected_from", { enum: ["email", "manual", "screenshot"] })
      .default("email")
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("charges_user_idx").on(t.userId),
    index("charges_user_merchant_idx").on(t.userId, t.merchantId),
    uniqueIndex("charges_user_message_idx").on(t.userId, t.sourceMessageRef),
  ],
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    merchantId: integer("merchant_id"),
    name: text("name").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    cycle: text("cycle", { enum: ["weekly", "monthly", "quarterly", "yearly"] }).notNull(),
    status: text("status", {
      enum: [
        "active",
        "possible", // one observed charge — not yet confirmed (§5.3)
        "needs_review", // below-confidence extraction — never silently saved (§5.2)
        "cancellation_requested", // user sent a request; NOT "done" (§10.2)
        "cancelled", // provider confirmed
        "ignored",
      ],
    }).notNull(),
    detectedFrom: text("detected_from", { enum: ["email", "manual", "screenshot"] })
      .default("email")
      .notNull(),
    confidence: integer("confidence"), // 0–100
    firstChargeAt: integer("first_charge_at", { mode: "timestamp_ms" }),
    lastChargeAt: integer("last_charge_at", { mode: "timestamp_ms" }),
    nextRenewalAt: integer("next_renewal_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)],
);

// Join table backing the "what we saw" log (§6): which emails produced a
// subscription, by message ref + date + subject. Never bodies.
export const subscriptionEvidence = sqliteTable(
  "subscription_evidence",
  {
    subscriptionId: integer("subscription_id").notNull(),
    chargeId: integer("charge_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.subscriptionId, t.chargeId] })],
);

export const priceChanges = sqliteTable(
  "price_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subscriptionId: integer("subscription_id").notNull(),
    oldAmountMinor: integer("old_amount_minor").notNull(),
    newAmountMinor: integer("new_amount_minor").notNull(),
    currency: text("currency").notNull(),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
    userNotifiedAt: integer("user_notified_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("price_changes_subscription_idx").on(t.subscriptionId)],
);

export const cancellationRequests = sqliteTable(
  "cancellation_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    subscriptionId: integer("subscription_id").notNull(),
    // v1 status enum split (§7): draft → request_sent → provider_confirmed
    status: text("status", { enum: ["draft", "request_sent", "provider_confirmed"] })
      .default("draft")
      .notNull(),
    method: text("method", { enum: ["url", "email", "phone", "unknown"] }).notNull(),
    draftSubject: text("draft_subject"),
    draftBody: text("draft_body"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("cancellation_requests_user_idx").on(t.userId)],
);

export const spendSnapshots = sqliteTable(
  "spend_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    month: text("month").notNull(), // YYYY-MM
    // normalized monthly totals in minor units, keyed by currency then category
    totalsByCurrency: text("totals_by_currency", { mode: "json" })
      .$type<Record<string, { total: number; byCategory: Record<string, number> }>>()
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("spend_snapshots_user_month_idx").on(t.userId, t.month)],
);

// Stripe webhook idempotency ledger: an event id lands here exactly once.
export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(), // Stripe event id
  type: text("type").notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }).default(now).notNull(),
});
