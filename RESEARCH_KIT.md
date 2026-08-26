# SubZero — Beta Research Kit

Purpose: turn the ≤100 Google test-user slots into evidence instead of impressions. Three instruments: an in-app micro-survey, an interview guide for the first ten users, and the events to instrument. Feed the results into `/design:research-synthesis` once data exists.

**The two questions this beta must answer:**
1. **Accuracy** — does the scan find what the user expected to see? (If not, nothing else matters.)
2. **Action** — after seeing the list, do they actually try to cancel something? (That's the value moment; without it we're a spreadsheet.)

Everything below serves those two. Anything that doesn't, cut.

---

## 1. Post-scan micro-survey (in-app)

**Where:** on the results-summary screen, after the total is revealed — the emotional peak, highest response rate. Dismissible, never blocking, asked once per user.
**Form:** three questions, tap-only except the last free-text. Target completion under 20 seconds.

**Q1 — Accuracy (single select)**
"Does this list match what you expected?"
- Yes, that's all of them
- Mostly — a few are missing
- It missed a lot
- It found things I'd forgotten ← *(the win condition; track separately)*

**Q2 — Gap (free text, optional, shown only if "missing" chosen)**
"Which subscriptions are missing?"
→ Every answer is a merchant-database gap. This question builds your moat.

**Q3 — Willingness to pay (single select)**
"To see the full list, SubZero is $4.99/month. Would you?"
- Yes, worth it
- Maybe later
- No — too expensive
- No — I'd rather do it myself

**Q3b — if "No" (free text, optional):** "What would make it worth paying for?"

**Rules:** never gate the product behind the survey; never ask again if dismissed; store answers against the pseudonymized user id; the survey is not a paywall and must not look like one.

**Implementation:** `src/app/dashboard/post-scan-survey.tsx`, served by `research.surveyStatus` / `research.submitSurvey`; responses in the `survey_responses` table (unique per user + survey, so dismissal is final).

---

## 2. Beta interview guide (first 10 users, 25 minutes, video call)

Recruit from users who completed a scan, mixed: some who upgraded, some who didn't. Record with consent. One interviewer, no pitching — every minute you spend explaining is a minute of data lost.

**Warm-up (3 min)**
1. Before SubZero, how did you keep track of your subscriptions? *(Establishes the status quo you're competing with — usually "I don't.")*
2. What made you try it?

**The scan moment (8 min) — the core**
3. Walk me through what you saw when the results appeared. What was the first thing you noticed?
4. Was anything surprising? *(Listen for: forgotten subscriptions, price increases, the total itself.)*
5. Was anything wrong or confusing? *(Accuracy signal. Probe specifics — which merchant, what was wrong.)*
6. What did you expect to see that wasn't there?

**Action (8 min)**
7. After seeing the list, what did you do next? *(If nothing: what stopped you?)*
8. Did you try to cancel anything? Tell me what happened. *(Probe the whole path — did they use our link/draft, or go their own way? Did the provider confirm?)*
9. If SubZero disappeared tomorrow, what would you miss?

**Value (4 min)**
10. What would you tell a friend this app does? *(Their words are your marketing copy.)*
11. What would make this worth paying for — or worth more than you pay now?

**Discipline:** ask, then shut up. Never defend the product. When they say something surprising, ask "why?" once more before moving on. Note verbatim quotes — the synthesis later needs their words, not your paraphrase.

---

## 3. Instrumentation (what the product must record)

Implemented first-party in `src/services/analytics.ts` (`track()`) with the `analytics_events` table; client-side steps go through `research.event`.

### 3.1 Activation funnel — one event per step, per user
`signed_in → inbox_connected → scan_started → scan_completed → results_viewed → review_completed → upgraded`

Drop-off between any two steps is the highest-value number in the business. Expected weak links: consent screen (Google's scary permission text) and results → upgrade (the paywall).

### 3.2 Accuracy signals (already half-built in admin 4.4)
- Corrections per user: edits to merchant, amount, or cycle after a scan (`subscription_corrected`)
- Needs-review queue: accept vs. reject rate per confidence band (`review_accepted` / `review_rejected`) → validates the 0.8 auto-accept threshold
- "Not mine" / "not a subscription" marks per merchant (`subscription_ignored`) → merchant-database noise
- Survey Q2 answers → merchant-database gaps
- **Aggregator watch:** after D6, how many Apple/Google/PayPal receipts split into real per-service subscriptions (`aggregator_split`, value = charges created) vs. stay as storefront groups

### 3.3 Action signals
- Cancellation drafts created / opened in mail client (`cancellation_drafted`)
- Requests marked sent (`cancellation_sent`)
- Requests marked provider-confirmed (`cancellation_confirmed`) ← **the north star; this is the only event that proves SubZero worked**
- Time from results to first cancellation attempt (derived from event timestamps)

### 3.4 Health
- Scan duration (p50/p95), failure rate by cause (`scan_failed`), Stage-2 AI cost per user, subscriptions found per user (distribution, not average)

**Privacy rules, unchanged:** events carry pseudonymized user ids and never merchant-level personal data in third-party tools; survey free-text is stored in our own database, not shipped to an analytics vendor; nothing here touches email content, which no longer exists after a scan. Enforced by `tests/analytics-privacy.test.ts`.

---

## 4. Success criteria for the beta

Not vanity metrics — decision thresholds. Write your guesses down now, before data arrives, so you can be wrong honestly:

| Metric | Threshold to proceed | If below |
|---|---|---|
| Scan → results completion | ≥ 80% | Fix the scan pipeline before anything else |
| "Found things I'd forgotten" (Q1) | ≥ 40% | The core promise isn't landing — revisit detection depth |
| Correction rate per subscription | ≤ 15% | Extraction quality blocks launch; tune Stage 2 |
| Results → upgrade | ≥ 5% | Test the teaser boundary or the price, not the product |
| Cancellation attempted | ≥ 25% of users | The escape path is decorative; rebuild the cancellation flow |
| Provider-confirmed cancellations | any > 0 | If zero, the entire cancellation value prop is unproven |

## 5. Cadence

- **Weekly:** funnel numbers + accuracy signals, 15 minutes, no slides.
- **After 10 interviews:** run `/design:research-synthesis` on the transcripts + survey data → themes, segments, prioritized recommendations.
- **Before public launch:** one go/no-go review against §4 thresholds.
