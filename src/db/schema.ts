import {
  mysqlTable,
  varchar,
  int,
  bigint,
  timestamp,
  mysqlEnum,
  json,
  text,
  boolean,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/mysql-core";

// Carried from SubZero v1 (Clerk IDs replace Manus IDs). The v1 `email_tokens`
// table is intentionally gone — OAuth refresh tokens live encrypted on
// `email_accounts` and nowhere else (§6, §7).

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // Clerk user ID
    email: varchar("email", { length: 320 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const profiles = mysqlTable("profiles", {
  userId: varchar("user_id", { length: 64 }).primaryKey(),
  displayName: varchar("display_name", { length: 255 }),
  plan: mysqlEnum("plan", ["free", "pro"]).default("free").notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 64 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const emailAccounts = mysqlTable(
  "email_accounts",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    provider: mysqlEnum("provider", ["gmail", "outlook", "agentmail"]).notNull(),
    address: varchar("address", { length: 320 }).notNull(),
    // AES-256-GCM ciphertext (per-user derived key). NEVER a plaintext token.
    encryptedRefreshToken: text("encrypted_refresh_token"),
    syncCursor: varchar("sync_cursor", { length: 128 }), // Gmail historyId / delta cursor
    status: mysqlEnum("status", ["active", "revoked", "error"]).default("active").notNull(),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("email_accounts_user_idx").on(t.userId),
    uniqueIndex("email_accounts_user_address_idx").on(t.userId, t.address),
  ],
);

export const merchants = mysqlTable(
  "merchants",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(), // canonical name
    slug: varchar("slug", { length: 255 }).notNull(),
    domains: json("domains").$type<string[]>().notNull(), // known billing/sender domains
    category: varchar("category", { length: 64 }).notNull(),
    logoUrl: varchar("logo_url", { length: 512 }),
    cancelUrl: varchar("cancel_url", { length: 512 }),
    cancelMethod: mysqlEnum("cancel_method", ["url", "email", "phone", "unknown"])
      .default("unknown")
      .notNull(),
    cancelEmail: varchar("cancel_email", { length: 320 }),
    difficulty: int("difficulty").default(3).notNull(), // 1 (easy) – 5 (hostile)
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("merchants_slug_idx").on(t.slug)],
);

export const charges = mysqlTable(
  "charges",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    merchantId: bigint("merchant_id", { mode: "number" }),
    merchantName: varchar("merchant_name", { length: 255 }).notNull(), // as observed
    amountMinor: int("amount_minor").notNull(), // minor units (cents)
    currency: varchar("currency", { length: 3 }).notNull(),
    chargedAt: timestamp("charged_at").notNull(),
    // Reference only — message id + date + subject. Never the body (§6).
    sourceMessageRef: varchar("source_message_ref", { length: 255 }),
    sourceSubject: varchar("source_subject", { length: 512 }),
    extractionConfidence: int("extraction_confidence"), // 0–100; null = Stage 1 deterministic match
    reviewedAt: timestamp("reviewed_at"), // user approved a below-threshold extraction
    detectedFrom: mysqlEnum("detected_from", ["email", "manual", "screenshot"])
      .default("email")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("charges_user_idx").on(t.userId),
    index("charges_user_merchant_idx").on(t.userId, t.merchantId),
    uniqueIndex("charges_user_message_idx").on(t.userId, t.sourceMessageRef),
  ],
);

export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    merchantId: bigint("merchant_id", { mode: "number" }),
    name: varchar("name", { length: 255 }).notNull(),
    amountMinor: int("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    cycle: mysqlEnum("cycle", ["weekly", "monthly", "quarterly", "yearly"]).notNull(),
    status: mysqlEnum("status", [
      "active",
      "possible", // one observed charge — not yet confirmed (§5.3)
      "needs_review", // below-confidence extraction — never silently saved (§5.2)
      "cancellation_requested", // user sent a request; NOT "done" (§10.2)
      "cancelled", // provider confirmed
      "ignored",
    ]).notNull(),
    detectedFrom: mysqlEnum("detected_from", ["email", "manual", "screenshot"])
      .default("email")
      .notNull(),
    confidence: int("confidence"), // 0–100
    firstChargeAt: timestamp("first_charge_at"),
    lastChargeAt: timestamp("last_charge_at"),
    nextRenewalAt: timestamp("next_renewal_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)],
);

// Join table backing the "what we saw" log (§6): which emails produced a
// subscription, by message ref + date + subject. Never bodies.
export const subscriptionEvidence = mysqlTable(
  "subscription_evidence",
  {
    subscriptionId: bigint("subscription_id", { mode: "number" }).notNull(),
    chargeId: bigint("charge_id", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.subscriptionId, t.chargeId] })],
);

export const priceChanges = mysqlTable(
  "price_changes",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    subscriptionId: bigint("subscription_id", { mode: "number" }).notNull(),
    oldAmountMinor: int("old_amount_minor").notNull(),
    newAmountMinor: int("new_amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    observedAt: timestamp("observed_at").notNull(),
    userNotifiedAt: timestamp("user_notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("price_changes_subscription_idx").on(t.subscriptionId)],
);

export const cancellationRequests = mysqlTable(
  "cancellation_requests",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    subscriptionId: bigint("subscription_id", { mode: "number" }).notNull(),
    // v1 status enum split (§7): draft → request_sent → provider_confirmed
    status: mysqlEnum("status", ["draft", "request_sent", "provider_confirmed"])
      .default("draft")
      .notNull(),
    method: mysqlEnum("method", ["url", "email", "phone", "unknown"]).notNull(),
    draftSubject: varchar("draft_subject", { length: 512 }),
    draftBody: text("draft_body"),
    sentAt: timestamp("sent_at"),
    confirmedAt: timestamp("confirmed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("cancellation_requests_user_idx").on(t.userId)],
);

export const spendSnapshots = mysqlTable(
  "spend_snapshots",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
    // normalized monthly totals in minor units, keyed by currency then category
    totalsByCurrency: json("totals_by_currency")
      .$type<Record<string, { total: number; byCategory: Record<string, number> }>>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("spend_snapshots_user_month_idx").on(t.userId, t.month)],
);

// Stripe webhook idempotency ledger: an event id lands here exactly once.
export const webhookEvents = mysqlTable("webhook_events", {
  id: varchar("id", { length: 255 }).primaryKey(), // Stripe event id
  type: varchar("type", { length: 128 }).notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});
