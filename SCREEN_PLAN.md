# SubZero — Master Screen & Feature Plan

The design script for the entire application, screen by screen. Companion to `SUBZERO_REBUILD_SPEC.md` (which stays the technical source of truth). Every screen lists: purpose, key elements, states, and phase.

**Phases:** `P0` = first working beta (≤100 test users) · `P1` = fast-follow · `P2` = future web + mobile.

---

## 0. Design laws (apply to every screen)

1. **Mobile-first.** Every screen is designed at 375px first, desktop second.
2. **Money is the hero.** The biggest element on any screen is a number the user cares about.
3. **Honesty (spec §10).** Only observed numbers. Per-currency totals, never synthetic FX conversion. "Cancelled" is never shown unless provider-confirmed.
4. **Every screen ships with all four states:** loading (skeleton, no spinners-only), empty (helpful, next-action), error (plain words + retry), and where relevant expired-permission (re-consent path). A screen without its states is not done.
5. **Evidence on demand.** Any detected fact can be traced to "what we saw" in one tap.
6. **Frost identity:** cold blues / ice whites, dark mode default, merchant logos everywhere, confident numerals.

---

## 1. First-run funnel (customer)

### 1.1 Landing page — P0
Purpose: convert a stranger into a scan.
Elements: hero headline + real product screenshot; 3-step "how it works" (Connect → Scan → Take control); privacy section selling process-and-discard ("we read receipts, we never store your emails"); pricing teaser; FAQ; footer with Privacy Policy + Terms links.
States: static page; no auth.
Notes: Privacy Policy + Terms are real routes (`/privacy`, `/terms`) — required for Google verification. P0 not because it must be beautiful, but because it must exist.

### 1.2 Create account / Sign in — P0
Purpose: identity via Clerk, Google sign-in primary.
Elements: single Google button + email fallback; one line of reassurance ("Sign-in only — inbox access is a separate permission you grant next, and can revoke any time").
States: loading, auth error, already-signed-in redirect.

### 1.3 Inbox-permission explainer — P0
Purpose: the consent bridge. Convert fear into trust BEFORE the scary Google screen.
Elements: exactly what we request (read-only), exactly what we do (search billing emails, extract merchant/amount/date, discard the email), exactly what we never do (store bodies, send, delete); "you can disconnect in one tap" promise; [Continue to Google] CTA.
States: n/a (static).
Notes: highest-leverage copy in the product. This screen decides the activation rate.

### 1.4 Google consent screen — P0 (external)
Not ours, but designed around: app name, logo (post-verification), and the single gmail.readonly scope must match the explainer's promise word for word.

### 1.5 Connect inbox — P0
Purpose: land the OAuth callback, confirm connection.
Elements: connected address with green check; [Start scan] CTA; add-another-inbox (gated: free = 1, Pro = unlimited).
States: OAuth denied (explain + retry), token exchange error, already-connected.

### 1.6 Live scan progress — P0
Purpose: turn a 1–3 minute wait into anticipation.
Elements: animated counter ("Searched 214 emails… found 12 subscriptions… 17… 23"), stage indicator (Searching → Extracting → Confirming), cancel option.
States: in-progress (polling an async scan job), scan failed (retry + support), zero-found (see 1.8).
Notes: requires async job + progress endpoint (real engineering, budgeted in Phase A).

### 1.7 Results summary — P0
Purpose: the emotional peak. The moment of truth.
Elements: "We found **23 subscriptions** costing **€212/month** (€2,544/year)" per currency; confirmed vs possible split; top-3 most expensive with logos; [Review & take control] CTA.
P1: **share card** — the same summary rendered as a beautiful downloadable/shareable image (anonymized amounts optional). This is the viral loop.
States: zero-results ("Your inbox is clean — or your subscriptions live in another inbox; connect it?"), partial-scan warning.
**D5 (teaser paywall):** for unpaid users this screen IS the teaser — per-currency totals, subscription count, and the most expensive confirmed subscription in full (evidence included); all other rows arrive from the API already redacted and render as blurred locked rows with the upgrade CTA. Redaction happens server-side; the client never receives locked merchants or amounts.

### 1.8 Review uncertain findings (needs-review queue) — P0
Purpose: human confirmation of low-confidence Stage 2 extractions.
Elements: one card at a time — merchant guess, amount, date, source email subject/date; actions: Confirm / Edit / Not a subscription; progress ("4 of 9").
States: empty (all confident — skip screen), done.

### 1.9 Post-scan triage wizard — P1
Purpose: convert the list into decisions.
Elements: swipe/tap through every confirmed subscription: **Keep / Cancel this / Ignore / Not mine**; running tally; end screen "You chose to cancel 6, worth €54/month of observed charges" → drops into Cancellation Center.
States: skippable at any point; resumable.

---

## 2. Main application (nav: Overview · Subscriptions · Renewals · Price changes · Cancellation center · Connected inboxes · Settings)

### 2.1 Overview (dashboard) — P0
Purpose: the daily truth screen.
Elements: monthly total per currency (hero number); active count; next renewal ("Netflix renews in 3 days — €13.99"); price-increase alerts strip; recent activity; [Re-scan] with plan-cadence state ("next re-scan unlocks 12 Sep" for free).
States: loading skeleton, no-data (points to connect/scan), expired-permission banner (Gmail token revoked → reconnect), scan-in-progress strip, **teaser paywall variant (D5): totals + count + one unlocked subscription, blurred locked rows, upgrade CTA; no re-scan.**

### 2.2 All subscriptions — P0
Purpose: the full inventory.
Elements: cards with logo, name, amount + cycle, normalized monthly cost, status chip (active / possible / needs review / cancel requested / provider confirmed / ignored); filter by status/category/inbox; sort by cost/name/renewal; per-currency section totals.
States: empty, filtered-empty, **teaser (D5): only the unlocked subscription renders; the rest are locked placeholders.**

### 2.3 Subscription detail — P0
Purpose: everything we know about one merchant relationship.
Elements: header (logo, name, amount, cycle, next expected charge); charge-history timeline; price-change history ("was €11.99 → now €13.99, observed 3 Mar"); **evidence log** ("what we saw": email dates + subjects that produced this record); editable fields (amount, cycle, category, notes); escape panel → cancellation options.
States: possible-subscription variant (one charge — explain why unconfirmed), editing, save error.

### 2.4 Renewals — P1
Purpose: what's about to charge you.
Elements: chronological upcoming renewals (computed from observed cycle + last charge, labeled "expected"); 7-day alert toggles per subscription.
States: empty ("no renewals expected in the next 30 days").

### 2.5 Price changes — P1
Purpose: the watchdog feed.
Elements: every observed price change, old → new, date, yearly impact ("+€24/year"); mark-as-seen.
States: empty ("no price changes observed — we're watching").

### 2.6 Cancellation center — P0 (board), P1 (sending) · **Basic+ only (D5)**
Purpose: the pipeline of escapes.
Elements: board columns **Draft → Request sent → Provider confirmed**; each card: merchant, monthly amount at stake, days since request; follow-up nudge after 7 silent days; running "monthly money freed" total (observed amounts only).
States: empty (points to triage/list), per-card error states.

### 2.7 Cancellation options (per subscription) — P0 · **Basic+ only (D5)**
Purpose: choose the escape route.
Elements: from the merchant playbook — cancel URL (only if verified) with difficulty meter (1–5 snowflakes), phone if known, and **email draft** path; honest labeling: "This prepares your request — the provider must confirm."
States: unknown-merchant playbook (draft-only + "help us: how did you cancel?" feedback).

### 2.8 Cancellation email draft — P0
Purpose: the prepared request.
Elements: pre-filled polite cancellation email (account email, merchant, service, request + confirmation ask); user edits; **default path: open in user's own mail app (mailto/Gmail deep link) — sent from their identity, which merchants accept**; P1 assist path: SubZero sends via its own sending domain where proven to work, always CC'ing the user.
States: copied/opened confirmation → auto-moves card to "Request sent" only after user confirms they sent it.

### 2.9 Cancellation-status tracking — P0
Purpose: close the loop honestly.
Elements: per-request timeline (drafted → sent → follow-up → confirmed); [Mark provider-confirmed] with optional confirmation-email evidence; P1: inbound replies surfaced automatically (assist path).
States: stale (>14 days) prompt.

### 2.10 Connected inboxes — P0
Purpose: control over access.
Elements: each inbox: address, status (healthy / expired / revoked), last scan, found-count; [Re-scan] (cadence-gated); **[Disconnect]** with choice: keep extracted data or delete everything derived from this inbox; add-inbox (plan-gated).
States: expired-permission (reconnect flow), disconnect confirm.

### 2.11 Settings — P0
Sections:
- **Profile** — name, email, language. P0.
- **Notifications** — renewal alerts, price-increase alerts, scan-complete; email now, push P2. P1 (defaults on at P0 without UI).
- **Plan & billing** — current plan (teaser / Basic / Pro per D5), usage vs limits, upgrade → Stripe checkout (monthly or annual), invoices + cancel via Stripe portal. P0.
- **Privacy & data** — what we store (and don't), **export my data** (JSON/CSV download), **delete my account** (full derived-data deletion + token revocation, typed confirmation). Export P1, deletion P0 (legal requirement).
States: each action has confirm + result states.

---

## 3. Universal & edge screens — P0
- **Failed scan** — plain-language cause (token expired / Gmail rate limit / our error), one retry button, support link.
- **No results** — celebratory-but-useful; suggest second inbox.
- **Expired permission** — banner + dedicated reconnect screen; explains Google tokens expire, one-tap re-consent.
- **Multi-currency** — totals always per currency, side by side; never converted or merged (design law 3).
- **404 / error boundary / maintenance** — on-brand, one action each.
- **Paywall moments** — cadence gate, second-inbox gate: show exactly what Pro unlocks, price, one tap to checkout. Never dark-patterned; dismissible.

---

## 4. Admin panel (`/admin` — role-gated)

Beta reality: at P0 the only admin is the founder (Super administrator). The panel below is designed complete but built in phase order.

> **Built (D8):** 4.1 health, 4.2 scan monitoring, 4.4 extraction quality, 4.6 merchant directory, 4.12 audit-log viewer, plus a plan-distribution slice of 4.8. Membership is `ADMIN_USER_IDS` (an environment variable, not a database column); non-admins get a 404, not a 403. Every screen is gated twice — server-side in the layout and again on each `adminProcedure`.

### 4.1 Admin dashboard & system health — P0
Live counts: users, connected inboxes, scans today, error rate, Stage 2 AI spend today, webhook health, queue depth. Red/amber/green per subsystem.

### 4.2 Inbox scan monitoring — P0
Every scan run: user (pseudonymized id), inbox, duration, emails touched, found, failed stage, error. Filter by status. Re-run action (audited).

### 4.3 Background jobs, retries & dead-letter queue — P1
Job list with attempts and next retry; DLQ with payload metadata (never email bodies); requeue / discard (audited).

### 4.4 Extraction-quality review — P0
Random + flagged sample of Stage 2 extractions: model output vs user correction; accept-rate metric; feeds prompt tuning and merchant-DB growth. Shows extracted fields + email subject/date only — never bodies (they no longer exist; see security rule 1).

### 4.5 Recurrence & duplicate detection review — P1
Groups the engine merged or split; manual merge/split tools; duplicate-merchant candidates (e.g. "Netflix" vs "Netflix Intl") feeding matching rules.

### 4.6 Merchant directory & matching rules — P0
The 421+ merchants in an editable table: name, domains, category, logo, cancel_method, cancel_url (+ verified flag & date & by-whom), cancel_email, difficulty. Rule: unverified URLs never render to customers. Add-merchant from Stage 2 discoveries queue.

> **D8:** the rule is enforced at one chokepoint, `customerMerchant()` in `src/server/merchant-view.ts`, which every customer-facing router passes merchant rows through — it strips an unverified URL *and* the verification metadata (who checked it, against what) from the payload. Publishing a URL in the panel requires a source note. `tests/merchant-view.test.ts` holds it.

### 4.7 Cancellation-playbook creation & verification — P1
Workflow queue: unplayed merchants ranked by customer demand → research → draft playbook → verify → publish. Verification requires a source note.

### 4.8 Customer-support console — P1
Search customer by email/id (every search audited); redacted profile: plan, inboxes (status only), subscription count, recent scans, recent cancellation requests. No amounts unless the ticket requires it (reveal action, audited). Comp-Pro action.

### 4.9 Cancellation-request support — P1
All cancellation requests across users, filterable by stale/no-reply; canned follow-up guidance; escalation notes.

### 4.10 Plans, payments & refunds — P1
Stripe mirror: MRR, subscriber counts, churn; per-customer invoices; refund action (step-up auth + reason, audited).

### 4.11 Privacy exports & account deletion — P0 (actions exist), P1 (console)
Queue of user-requested exports/deletions with SLA timer; manual trigger; deletion produces a signed completion record.

### 4.12 Security events & immutable audit log — P0 (write), P1 (viewer)
Append-only log: every admin sign-in, customer search, sensitive reveal, refund, role change, deletion — actor, action, target, timestamp, IP. Export for compliance. Nothing in the product deletes from this log.

### 4.13 Feature flags & integrations — P2
Flags with per-plan/per-user targeting; integration keys status (never values); kill-switches for scan, sending, checkout.

### 4.14 Administrator accounts, roles & permissions — P1
Invite admin, assign role, step-up auth on change, deactivate. Role matrix below.

---

## 5. Admin roles

| Capability | Super | Sec/Priv | Ops | Merchant | Support | Finance | Analyst |
|---|---|---|---|---|---|---|---|
| System health & scans | ✓ | view | ✓ | – | – | – | view |
| Jobs / DLQ | ✓ | – | ✓ | – | – | – | view |
| Extraction & recurrence review | ✓ | – | ✓ | ✓ | – | – | view |
| Merchant directory & playbooks | ✓ | – | – | ✓ | suggest | – | view |
| Customer search (redacted) | ✓ | ✓ | – | – | ✓ | ✓ | – |
| Sensitive reveal | ✓ | ✓ | – | – | ticket-scoped | – | – |
| Refunds | ✓ | – | – | – | – | ✓ | – |
| Comp Pro | ✓ | – | – | – | ✓ | ✓ | – |
| Exports / deletions | ✓ | ✓ | – | – | – | – | – |
| Audit log | ✓ | ✓ | – | – | – | – | view |
| Feature flags | ✓ | – | ✓ | – | – | – | – |
| Roles & admins | ✓ | – | – | – | – | – | – |

P0: Super only. P1: Support + Merchant + Finance. P2: full separation + Analyst.

---

## 6. Security rules (product law, enforced not promised)

1. **Admins cannot see raw email bodies — ever, not just "by default."** The architecture guarantees it: bodies are discarded at processing time and never persisted. The UI can't show what doesn't exist.
2. **OAuth tokens and encryption keys never appear in any interface** — customer or admin. Status only (healthy/expired).
3. **Every customer search and sensitive action writes to the immutable audit log** (4.12) before the action completes.
4. **Refunds, deletions, and role changes require step-up authentication** (fresh re-auth, P1: hardware key/TOTP).
5. **High-risk actions (bulk deletion, role grant to Super, mass refund) require second-administrator approval** — P2, meaningful once a team exists.
6. **Support agents see redacted data scoped to the ticket**; every reveal beyond the redaction is an audited, reasoned action.

---

## 7. Phase summary

**P0 — first working beta:** funnel 1.1–1.8 · app 2.1, 2.2, 2.3, 2.6 (board), 2.7, 2.8 (user-sends), 2.9, 2.10, 2.11 (profile, billing, deletion) · all §3 states · admin 4.1, 4.2, 4.4, 4.6 · audit-log writes · security rules 1–3.

**P1 — fast-follow:** triage wizard 1.9 · share card · renewals 2.4 · price-changes feed 2.5 · SubZero-sends assist + inbound replies · notifications UI · data export · admin 4.3, 4.5, 4.7, 4.8, 4.9, 4.10, 4.11 console, 4.12 viewer, 4.14 · roles (Support/Merchant/Finance) · step-up auth.

**P2 — future:** mobile apps (Expo, same API) · push notifications · agentic cancellation · feature flags 4.13 · dual-approval + Analyst role · bank-signal confirmation · Outlook.
