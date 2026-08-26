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
