# SubZero v2

Find people's forgotten subscriptions in their email receipts — with explicit,
read-only consent — and give every one of them an escape path.

The build follows [`SUBZERO_REBUILD_SPEC.md`](./SUBZERO_REBUILD_SPEC.md) (the
single source of truth). The tested engine core from `subzero-core` is ported
as-is into `src/engine/`.

## Stack

- **Next.js (App Router)** on Vercel, **Clerk** auth (Google sign-in + incremental
  Gmail read-only consent)
- **PlanetScale (MySQL)** via **Drizzle ORM**, **tRPC** + Zod API
- **Ingestion worker**: targeted Gmail searches → Stage 1 merchant-DB matching →
  Stage 2 Claude extraction (ambiguous candidates only) → recurrence engine
- **Stripe** Pro billing (signed + idempotent webhooks)

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/` | Ported v1 core: money math, recurrence engine, extraction contract |
| `src/ingestion/` | Gmail queries/client, Stage 1 matcher, amount parser, Stage 2 transport, process-and-discard pipeline |
| `src/merchants/` + `data/merchants.seed.json` | 421-merchant Stage 1 seed with cancel playbooks (`cancel_url` stays null until verified) |
| `src/db/` | Drizzle schema (no `email_tokens`; refresh tokens live encrypted on `email_accounts`) |
| `src/server/` | tRPC routers: subscriptions, review queue, email accounts, cancellations, billing |
| `src/services/` | Scan worker, recurrence↔DB sync, cancellation-email drafting, Stripe |
| `src/app/` | Landing, dashboard (list, totals, needs-review, "what we saw"), OAuth + webhook + cron routes |
| `tests/` | Engine tests (ported) + pipeline privacy, matcher, parser, quotas, Stripe idempotency, … |

## Run it

```bash
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm dev         # needs .env — see .env.example
```

Database: `pnpm db:push` to sync the schema, `pnpm db:seed` to load the
merchant seed.

## Plans (decision D2 — see DECISIONS.md)

- **Free**: 1 connected inbox, monthly re-scan.
- **Pro**: unlimited inboxes, daily continuous sync, unmetered screenshot import.

## Rules this codebase lives by (spec §10)

1. Never display a number the system didn't observe — no synthetic trends, no
   heuristic savings, no FX-merged totals.
2. "Cancelled" means the user sent a request; only `provider_confirmed` is done.
3. Every AI-extracted field is editable and traceable to its source email.
4. Raw email bodies are processed in memory and discarded — verified by
   `tests/pipeline-privacy.test.ts`.
