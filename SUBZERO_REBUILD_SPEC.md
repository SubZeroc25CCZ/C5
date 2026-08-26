# SubZero v2 — Build Specification

**Purpose of this document:** Drop this file into the root of the new repository. It is the single source of truth for the rebuild. Claude Code should follow it phase by phase.

---

## 1. Problem statement

People accumulate recurring subscriptions they've forgotten, can't find, and don't know how to cancel. Existing tools either require bank linking (poor international coverage) or manual entry (nobody does it). The evidence of every subscription already sits in the user's inbox as receipts and renewal emails. SubZero reads that evidence — with explicit consent — and gives people their money back under their control.

## 2. Goals

1. A new user connects their inbox and sees a complete, accurate subscription list with a normalized monthly total in under 3 minutes.
2. Detect billing-cycle recurrence and price increases from real email history — never estimated, never fabricated.
3. Give every detected subscription an escape path: cancel URL, method, or drafted cancellation email.
4. Work internationally (multi-currency, no bank-linking dependency).
5. Pass Google restricted-scope verification (CASA) so the product can scale past 100 users.

## 3. Non-goals (v1)

- **No bank/card linking (Plaid etc.).** Email-first is the differentiator and works globally. Revisit later as an additional signal, not a foundation.
- **No autonomous cancellation.** v1 prepares and assists; it does not click through provider websites. (P2: agentic cancellation.)
- **No native mobile apps in v1.** Web-first, responsive. The Expo client returns in Phase 4.
- **No spending forecasts, "potential savings" heuristics, or synthetic trend charts.** If we didn't observe it, we don't show it.
- **No storage of raw email content.** Process and discard (see §6).

## 4. Architecture

```
User → Next.js (App Router) on Vercel
         ├─ Clerk: auth (Google sign-in) + incremental Gmail read-only consent
         ├─ tRPC API routes (reuse SubZero's router patterns)
         ├─ PlanetScale (MySQL) via Drizzle ORM  ← SubZero schema migrates as-is, minus email_tokens
         ├─ Ingestion worker (Vercel cron / queue)
         │    ├─ Gmail API: targeted search queries (never full-mailbox reads)
         │    ├─ Stage 1: merchant-database sender matching (free, instant, ~80% of hits)
         │    ├─ Stage 2: LLM extraction on ambiguous candidates only (Claude API, JSON output)
         │    └─ Recurrence engine → subscription records + price-change events
         ├─ AgentMail: forwarding-address ingestion (no-OAuth fallback track)
         └─ Stripe: Pro billing (webhook-signed, idempotent)
```

**What survives from SubZero v1:** Drizzle schema (minus `email_tokens`), normalization math (weekly ×4.33, quarterly ÷3, yearly ÷12), cancellation-email drafting service, Stripe integration, tRPC patterns, Zod validation.
**What is deleted:** all Manus OAuth code, Gmail/Outlook legacy scanner files, `email_tokens` table, randomized trend generator, 15% savings heuristic, screenshot-scan quota logic (screenshot import survives as a secondary capture method, unmetered in Pro).

## 5. Ingestion pipeline (the core)

### 5.1 Query strategy
Search, don't read. Against the last 24 months:
- `subject:(receipt OR invoice OR "payment confirmation" OR renewal OR subscription)`
- `{"has been charged" "payment was successful" "will renew" "auto-renew" "free trial ends"}`
- `from:` matches against the merchant database's known billing domains
- `category:purchases` as a Gmail-specific booster

Target: touch 200–500 messages per user, not the whole mailbox.

### 5.2 Two-stage classification
1. **Merchant DB match (Stage 1):** sender domain → merchant record (name, category, logo, cancel playbook). Zero AI cost. Seed the DB with the top ~300 global subscription merchants; it grows from Stage 2 confirmations.
2. **LLM extraction (Stage 2):** only for unmatched candidates. Strict JSON schema: `{merchant, amount, currency, date, cycle_hint, confidence}`. Below-threshold confidence → "needs review" queue in the UI, never silently saved.

### 5.3 Recurrence engine
Group extracted charges by normalized merchant. A subscription is **confirmed** when ≥2 charges match on merchant + approximate amount at a regular interval (weekly/monthly/quarterly/yearly ±4 days tolerance). One charge = "possible subscription," shown separately. Amount change between confirmed cycles → `price_change` event → user alert ("Netflix was €11.99, now €13.99").

### 5.4 Continuous sync
After backfill: daily delta sync per connected account (cron). Gmail push (Pub/Sub watch) is a P1 optimization.

## 6. Privacy architecture (non-negotiable, also the CASA narrative)

- Raw email bodies are fetched into worker memory, parsed, and **discarded**. Only extracted fields persist: merchant, amount, currency, date, cycle, message-id reference.
- Read-only scope only (`gmail.readonly`). Never request write/send.
- Per-user encryption of OAuth refresh tokens at rest; tokens revocable from the UI with one click, which also deletes derived data on request.
- A visible "what we saw" log per subscription: which emails (by date + subject) produced it.

## 7. Data model (Drizzle / MySQL)

- `users`, `profiles` — carried from v1, Clerk IDs replace Manus IDs
- `email_accounts` — provider, address, encrypted refresh token, sync cursor, status
- `merchants` — canonical name, domains[], category, logo, cancel_url, cancel_method (`url` | `email` | `phone` | `unknown`), difficulty (1–5)
- `charges` — userId, merchantId, amount, currency, chargedAt, sourceMessageRef, extraction_confidence
- `subscriptions` — carried from v1 + `detected_from` (`email` | `manual` | `screenshot`), `confidence`, `status` adds `needs_review`
- `price_changes` — subscriptionId, oldAmount, newAmount, observedAt
- `cancellation_requests` — carried from v1; status enum split: `draft` → `request_sent` → `provider_confirmed`
- `spend_snapshots` — userId, month, normalized totals by category (written by monthly cron; powers the *real* trend chart)

## 8. Requirements

### P0 — cannot ship without
- Clerk auth with Google sign-in; incremental consent screen for Gmail read-only
- Backfill scan (24 months) → subscription list + normalized monthly/annual totals, multi-currency
- Recurrence confirmation + needs-review queue
- Merchant DB with ≥300 seeded merchants incl. cancel playbooks
- "Prepare cancellation email" flow (renamed from "Cancel For Me"), with `request_sent` vs `provider_confirmed`
- Process-and-discard pipeline verified by test: no raw body ever written to DB or logs
- Rate limiting on all AI-touching endpoints; per-user scan quotas (free: 1 connected inbox; Pro: unlimited + continuous sync)
- Stripe checkout, portal, signed + idempotent webhooks, tested in staging
- CI (GitHub Actions): typecheck, tests, env fixtures for `EXPO_PUBLIC_APP_ID`-class variables

### P1 — fast follow
- Price-increase alerts (email/push)
- Monthly `spend_snapshots` cron + real trend chart
- AgentMail forwarding-address ingestion track
- Renewal reminders (7-day window, from v1)
- Sentry + structured logging

### P2 — architectural insurance
- Microsoft Graph / Outlook ingestion (cheaper compliance path than Google)
- Expo mobile client on the same tRPC API
- Agentic cancellation (browser automation against cancel playbooks)
- Bank feed as a secondary confirmation signal

## 9. Compliance track (start day 1, runs in parallel)

1. Create the Google Cloud project, OAuth consent screen, request `gmail.readonly`.
2. Operate in the ≤100 test-user window during build and beta.
3. File for restricted-scope verification + CASA assessment as soon as the privacy architecture (§6) is implemented — the assessment is against the production app.
4. Budget: low-thousands USD/year, annually recertified. Treat as a cost of goods.

## 10. Honesty rules (product constitution)

1. Never display a number the system didn't observe. No synthetic trends, no heuristic savings.
2. `cancelled` means the user sent a request — say so in the UI. `provider_confirmed` is the only "done."
3. Every AI-extracted field is editable and traceable to its source email.
4. When the scan finds nothing, say "no subscriptions found" — an empty state is a correct answer.

## 11. Build order for Claude Code

1. Scaffold Next.js + Clerk + Drizzle/PlanetScale + tRPC; port v1 schema and normalization module with tests.
2. Merchant DB seed + Stage 1 matcher.
3. Gmail OAuth (test mode) + backfill worker + Stage 2 extraction + recurrence engine.
4. Dashboard UI: list, totals, needs-review queue, "what we saw" log.
5. Cancellation flow port + rename + status split.
6. Stripe port + staging webhook verification.
7. CI, rate limits, Sentry. → Beta with ≤100 users. → File CASA.

## 12. Open questions

- Product name: keep "SubZero" or rebrand? (Owner: Avo — non-blocking, affects domain + OAuth consent branding)
- Free-plan definition: 1 inbox + monthly re-scan vs. one-time scan? (Owner: Avo — blocking for Stripe setup, not for build start)
- Seed merchant list priorities by market: EU/UK/IL/TH/PH coverage beyond the US top-300? (Owner: Avo + data — non-blocking)
