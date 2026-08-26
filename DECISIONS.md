# Decisions log

Resolutions for the open questions in `SUBZERO_REBUILD_SPEC.md` §12.

## D1 — Product name: keep "SubZero" (2026-08-26)

Rebranding during the compliance track would mean a new domain and re-branding
the Google OAuth consent screen mid-CASA for no product gain. The name already
encodes the pitch (freeze your subscriptions). Revisit only if a trademark
conflict surfaces.

## D2 — Free plan: 1 inbox + monthly re-scan (2026-08-26)

Chosen over a one-time scan. Rationale:

- A one-time scan leaves a decaying dashboard; stale data kills retention and
  the price-increase-alert funnel that converts to Pro.
- The Pro differentiators stay sharp: **unlimited inboxes** and **daily**
  continuous sync vs. the free **monthly** cadence.

Implementation: `PLAN_LIMITS` carries `syncIntervalDays` (free: 30, pro: 1).
The daily cron re-scans every account whose last sync is older than its plan's
interval; manual re-scans are held to the same cadence (plus the existing
per-user rate limits). This unblocks Stripe price setup: one Pro price,
monthly, per `STRIPE_PRO_PRICE_ID`.

## D3 — Seed merchant markets (2026-08-26)

EU/UK/IL/TH/PH coverage beyond the US top-300 is in the shipped 421-merchant
seed (e.g. Deliveroo/Sky/Canal+, yes/HOT/Haaretz/Wolt, TrueID/AIS Play/JOOX,
iWantTFC/Vivamax/Cignal Play). Future market depth comes from Stage 2
confirmations growing the DB, per §5.2.

## D5 — Plan structure: teaser / Basic / Pro (supersedes D2)

The free tier is a **teaser**, not a product. After the (fully free) scan an
unpaid user sees ONLY: per-currency totals, the subscription count, and the
single most expensive confirmed subscription in full (evidence included).
Every other row is redacted **at the API layer** — masked merchant, no
amounts, no ids — and rendered client-side as blurred locked rows. No
re-scans, no cancellation features, no export.

- **Basic — $2.99/mo or $29.90/yr**: full results, 1 inbox, 30-day re-scan
  cadence, evidence, price history, cancellation drafts + tracking.
- **Pro — $4.99/mo or $49.90/yr**: Basic + unlimited inboxes, daily sync,
  renewal and price-increase alerts.

Enforcement lives server-side (`PLAN_LIMITS`, `redactListForTeaser`, plan
gates on every cancellation/review procedure); tests prove locked data never
survives serialization. Legacy `plan = "free"` rows normalize to `teaser`.
Stripe carries the purchased plan in checkout + subscription metadata so
webhooks map to the right tier; subscription deletion downgrades to teaser.


## D6 — Aggregator merchants (from the first production scan)

Storefronts that bill many services on one receipt (Apple, Google, PayPal,
Amazon, Microsoft) are not single subscriptions: amounts vary because the
basket varies. Found live as "Apple Services · seen once" with 8 receipts
and a per-month label (§10 violation). Rules:

1. Badges always equal the evidence count.
2. Unconfirmed recurrence never renders a cycle — "per charge" / observed
   total instead, and never joins the monthly total.
3. Aggregators render as a "storefront charges" group: observed spend over
   the period plus an explainer ("bills many services together — amounts
   vary"). They are excluded from monthly totals even when the engine finds
   a cadence in the aggregate.
4. Durable fix: Stage 2 extraction captures `items[]` at scan time (bodies
   are discarded afterwards — unrecoverable later). Aggregator senders skip
   the Stage 1 single-total shortcut; receipts with ≥2 line items split into
   one charge per service (`messageRef#n`), so each service builds real
   recurrence.

## D7 — Final pricing (supersedes D5 test prices)

Basic **$4.99/mo · $49/yr** — Pro **$9.99/mo · $99/yr**. Stripe test-mode
prices replaced; code defaults, pricing page, landing cards, and paywall
copy updated.
