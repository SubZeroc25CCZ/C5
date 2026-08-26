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
    id: text("id").primaryKey(), // Clerk user ID — the only identity that counts
    email: text("email").notNull(),
    createdAt: createdAt(),
  },
  // Deliberately NOT unique. This table mirrors Clerk identities, and Clerk
  // does not guarantee one identity per address: the same person can hold a
  // second one through a different sign-in method or a provider change. The
  // unique index asserted an invariant the upstream system never promised,
  // and the way it failed was a 500 on /dashboard during server render
  // (UNIQUE constraint failed: users.email) for anyone who acquired one.
  // Uniqueness belongs in Clerk's own configuration, not in a mirror of it.
  (t) => [index("users_email_idx").on(t.email)],
);

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  plan: text("plan", { enum: ["free", "teaser", "basic", "pro"] }).default("free").notNull(), // "free" = legacy teaser
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
    // §4.6 rule: an unverified cancel URL never renders to a customer. These
    // three columns are the verification record — when, by which admin, and
    // against what source (§4.7 requires a source note).
    cancelUrlVerifiedAt: integer("cancel_url_verified_at", { mode: "timestamp_ms" }),
    cancelUrlVerifiedBy: text("cancel_url_verified_by"),
    cancelUrlSource: text("cancel_url_source"),
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

// Every message the pipeline has processed for a user, whatever the
// outcome — persisted, discarded, or one-time purchase. This is what makes
// batched scans terminate: without it, discarded candidates would be
// re-listed and re-processed (and re-billed) on every batch.
export const scannedMessages = sqliteTable(
  "scanned_messages",
  {
    userId: text("user_id").notNull(),
    messageRef: text("message_ref").notNull(),
    scannedAt: integer("scanned_at", { mode: "timestamp_ms" }).default(now).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.messageRef] })],
);

// Stripe webhook idempotency ledger: an event id lands here exactly once.
export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(), // Stripe event id
  type: text("type").notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }).default(now).notNull(),
});

// ── Beta research kit ────────────────────────────────────────────────────
// Two tables serving the two questions the beta must answer: accuracy
// (does the scan find what the user expected?) and action (do they try to
// cancel?). Both are keyed by the Clerk user id — no merchant-level
// personal data ever leaves for a third-party analytics vendor, and
// free-text answers live here, in our own database.

export const surveyResponses = sqliteTable(
  "survey_responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    /** Which survey this is; today only the post-scan micro-survey. */
    survey: text("survey", { enum: ["post_scan"] }).default("post_scan").notNull(),
    /** Q1 accuracy. "dismissed" records a decline so we never ask twice. */
    accuracy: text("accuracy", {
      enum: ["all_of_them", "mostly", "missed_a_lot", "found_forgotten", "dismissed"],
    }).notNull(),
    /** Q2: which subscriptions were missing — merchant-database gaps. */
    missingText: text("missing_text"),
    /** Q3 willingness to pay. */
    willingness: text("willingness", {
      enum: ["yes", "maybe_later", "too_expensive", "diy", "unanswered"],
    })
      .default("unanswered")
      .notNull(),
    /** Q3b: what would make it worth paying for. */
    willingnessText: text("willingness_text"),
    createdAt: createdAt(),
  },
  // One response per user per survey: asked once, never again.
  (t) => [uniqueIndex("survey_responses_user_survey_idx").on(t.userId, t.survey)],
);

// ── Admin panel (§4) ─────────────────────────────────────────────────────

/**
 * Every scan run, for admin 4.2. Deliberately metadata only: a pseudonymous
 * user id, which inbox, how long, how many messages, what failed — never a
 * subject line and never a body (security rule 1; bodies no longer exist).
 */
export const scanRuns = sqliteTable(
  "scan_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    emailAccountId: integer("email_account_id").notNull(),
    mode: text("mode", { enum: ["backfill", "delta"] }).notNull(),
    status: text("status", { enum: ["running", "succeeded", "failed"] })
      .default("running")
      .notNull(),
    /** Which pipeline stage the run died in, when it died. */
    failedStage: text("failed_stage", {
      enum: ["auth", "list", "fetch", "extract", "persist", "sync"],
    }),
    /** Error class + message. Never a payload, never message content. */
    error: text("error"),
    messagesTouched: integer("messages_touched").default(0).notNull(),
    chargesFound: integer("charges_found").default(0).notNull(),
    /** Started by the user, the daily cron, or an audited admin re-run. */
    trigger: text("trigger", { enum: ["user", "cron", "admin"] }).default("user").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).default(now).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    durationMs: integer("duration_ms"),
  },
  (t) => [
    index("scan_runs_started_idx").on(t.startedAt),
    index("scan_runs_user_idx").on(t.userId, t.startedAt),
  ],
);

/**
 * The immutable audit log (§4.12). Security rule 3: every admin sign-in,
 * customer lookup, sensitive reveal and mutation writes here BEFORE the
 * action completes. Nothing in the product deletes from this table — there
 * is deliberately no delete path in any router.
 */
export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** The admin who acted (Clerk id) — never an impersonated user. */
    actorUserId: text("actor_user_id").notNull(),
    action: text("action").notNull(),
    /** What was acted on: "merchant:42", "user:user_abc", "scan:7". */
    target: text("target"),
    /** Short reason or diff summary. Never tokens, never email content. */
    detail: text("detail"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt)],
);

/** Product analytics: the activation funnel plus accuracy/action signals. */
export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(), // pseudonymous: the Clerk id, never an email
    name: text("name").notNull(),
    /** Small numeric payload (durations, counts) — never merchant names. */
    value: integer("value"),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_events_name_idx").on(t.name, t.createdAt)],
);
