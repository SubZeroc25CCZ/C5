"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatMinor, minorToMajor } from "@/lib/money";
import { normalizedMonthly } from "@/engine/normalize";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  MerchantLogo,
  ProgressBar,
  Stat,
  StatusBadge,
  cx,
} from "@/components/ui";
import { TriageWizard } from "./triage-wizard";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type ListPayload = inferRouterOutputs<AppRouter>["subscriptions"]["list"];
export type FullListPayload = Extract<ListPayload, { teaser: false }>;
type TeaserPayload = Extract<ListPayload, { teaser: true }>;
type Row = FullListPayload["subscriptions"][number];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "possible", label: "Seen once" },
  { key: "cancellation_requested", label: "Request sent" },
  { key: "cancelled", label: "Cancelled" },
  { key: "ignored", label: "Ignored" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

interface ScanState {
  running: boolean;
  processed: number;
  total: number | null;
  error?: string;
}

export function DashboardClient() {
  const utils = trpc.useUtils();
  const listQuery = trpc.subscriptions.list.useQuery();
  const reviewQuery = trpc.review.queue.useQuery();
  const accountsQuery = trpc.emailAccounts.list.useQuery();
  const planQuery = trpc.billing.plan.useQuery();

  const scan = trpc.emailAccounts.scan.useMutation();

  const [scanState, setScanState] = useState<ScanState>({
    running: false,
    processed: 0,
    total: null,
  });
  const [triageOpen, setTriageOpen] = useState(false);

  // Batched scan loop: each call handles up to 25 new messages so serverless
  // timeouts can't kill a big backfill, and the user watches real progress.
  async function runFullScan(accountId: number) {
    setScanState({ running: true, processed: 0, total: null });
    let processed = 0;
    let first = true;
    try {
      for (;;) {
        const result = await scan.mutateAsync({
          accountId,
          mode: "backfill",
          continuation: !first,
        });
        first = false;
        processed += result.candidates.processed;
        const total = processed + result.candidates.remaining;
        setScanState({ running: true, processed, total });
        await utils.subscriptions.list.invalidate();
        if (result.candidates.remaining === 0) break;
      }
      setScanState({ running: false, processed, total: processed });
      await utils.invalidate();
      setTriageOpen(true);
    } catch (error) {
      setScanState({
        running: false,
        processed,
        total: null,
        error: error instanceof Error ? error.message : "Scan failed",
      });
      await utils.invalidate();
    }
  }

  const data = listQuery.data;
  const accounts = accountsQuery.data ?? [];
  const plan = planQuery.data?.plan ?? "teaser";

  if (data?.teaser) {
    return (
      <TeaserDashboard
        data={data}
        accounts={accounts}
        scanState={scanState}
        onScan={runFullScan}
      />
    );
  }

  return (
    <FullDashboard
      data={data}
      accounts={accounts}
      plan={plan}
      scanState={scanState}
      onScan={runFullScan}
      reviewItems={reviewQuery.data ?? []}
      triageOpen={triageOpen}
      setTriageOpen={setTriageOpen}
      listLoaded={listQuery.isSuccess}
    />
  );
}

/* ===== Teaser (D5): redacted results + paywall. The server already stripped
   everything but totals, counts, and the one unlocked subscription — this
   component just renders what little it was given. ===== */
function TeaserDashboard({
  data,
  accounts,
  scanState,
  onScan,
}: {
  data: TeaserPayload;
  accounts: Account[];
  scanState: ScanState;
  onScan: (accountId: number) => void;
}) {
  const hasResults = data.counts.total > 0;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Your scan results</h1>
        <LinkButton href="/pricing">⭐ Unlock everything</LinkButton>
      </div>

      {data.totals.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-4">
          {data.totals.map((total) => (
            <Stat
              key={total.currency}
              label={`Monthly · ${total.currency}`}
              value={money(total.monthly, total.currency)}
              hint={`${money(total.yearly, total.currency)} / year`}
            />
          ))}
          <Stat
            label="Subscriptions found"
            value={data.counts.total}
            hint={`${data.counts.confirmed} confirmed · ${data.counts.possible} seen once`}
          />
        </div>
      )}

      <InboxPanel accounts={accounts} plan="teaser" scanState={scanState} onScan={onScan} />

      {hasResults ? (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Your most expensive subscription</h2>
          <p className="mb-3 text-sm text-muted">
            The free scan shows this one in full — evidence included. Everything else is waiting
            behind the unlock.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.unlocked && <SubscriptionCard row={data.unlocked as Row} />}
            {data.lockedRows.map((locked, index) => (
              <LockedCard key={index} status={locked.status} />
            ))}
          </div>
          {data.lockedRows.length > 0 && (
            <Card className="mt-6 border-frost bg-frost-soft/60 text-center">
              <h3 className="text-lg font-bold">
                Unlock {data.lockedRows.length} more subscription
                {data.lockedRows.length === 1 ? "" : "s"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Basic shows every subscription with evidence and price history, and prepares
                cancellations for the ones you don&rsquo;t want — from $2.99/month.
              </p>
              <div className="mt-4">
                <LinkButton href="/pricing" className="px-6 py-2.5">
                  See plans
                </LinkButton>
              </div>
            </Card>
          )}
        </section>
      ) : accounts.length > 0 && !scanState.running ? (
        <EmptyState icon="❄️" title="Run your free scan">
          Start the scan above — results show up here, free: your per-currency totals, how many
          subscriptions we found, and your most expensive one in full detail.
        </EmptyState>
      ) : null}
    </main>
  );
}

/** A locked row: deliberately empty — the server sent nothing to reveal. */
function LockedCard({ status }: { status: string }) {
  return (
    <Card className="relative h-full overflow-hidden">
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-surface-2" />
            <div>
              <div className="h-4 w-28 rounded bg-surface-2" />
              <div className="mt-1 h-3 w-16 rounded bg-surface-2" />
            </div>
          </div>
        </div>
        <div className="mt-4 h-6 w-24 rounded bg-surface-2" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="text-xl">🔒</span>
        <StatusBadge status={status} />
      </div>
    </Card>
  );
}

/* ===== Full dashboard (Basic / Pro) ===== */
function FullDashboard({
  data,
  accounts,
  plan,
  scanState,
  onScan,
  reviewItems,
  triageOpen,
  setTriageOpen,
  listLoaded,
}: {
  data: FullListPayload | undefined;
  accounts: Account[];
  plan: string;
  scanState: ScanState;
  onScan: (accountId: number) => void;
  reviewItems: ReviewItem[];
  triageOpen: boolean;
  setTriageOpen: (open: boolean) => void;
  listLoaded: boolean;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const rows = useMemo(() => data?.subscriptions ?? [], [data]);
  const totals = data?.totals ?? [];
  const alerts = data?.recentPriceChanges ?? [];

  const activeRows = rows.filter((row) => row.subscription.status === "active");
  const nextRenewal = activeRows
    .map((row) => row.subscription.nextRenewalAt)
    .filter((date): date is Date => !!date)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  const filtered = useMemo(() => {
    const subset = filter === "all" ? rows : rows.filter((row) => row.subscription.status === filter);
    return [...subset].sort((a, b) => monthlyCost(b) - monthlyCost(a));
  }, [rows, filter]);

  const subNameById = new Map(rows.map((row) => [row.subscription.id, row.subscription.name]));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Your subscriptions</h1>
        {rows.some(
          (row) => row.subscription.status === "active" || row.subscription.status === "possible",
        ) && (
          <Button variant="secondary" onClick={() => setTriageOpen(true)}>
            🃏 Review one by one
          </Button>
        )}
        {plan !== "pro" && (
          <LinkButton variant="secondary" href="/pricing">
            ⭐ Upgrade to Pro
          </LinkButton>
        )}
      </div>

      {/* Price-increase alerts — only observed changes, never predictions */}
      {alerts.length > 0 && (
        <Card className="mb-6 border-warn bg-warn-bg/40">
          <h3 className="font-semibold">💸 Price increases spotted</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {alerts.slice(0, 4).map((change) => (
              <li key={change.id}>
                <Link href={`/dashboard/subscriptions/${change.subscriptionId}`} className="hover:underline">
                  <strong>{subNameById.get(change.subscriptionId) ?? "A subscription"}</strong> was{" "}
                  {formatMinor(change.oldAmountMinor, change.currency)}, now{" "}
                  <strong>{formatMinor(change.newAmountMinor, change.currency)}</strong>{" "}
                  <span className="text-muted">
                    (observed {new Date(change.observedAt).toLocaleDateString()})
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Stat row */}
      {totals.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-4">
          {totals.map((total) => (
            <Stat
              key={total.currency}
              label={`Monthly · ${total.currency}`}
              value={money(total.monthly, total.currency)}
              hint={`${money(total.yearly, total.currency)} / year · ${total.activeCount} active`}
            />
          ))}
          <Stat
            label="Next renewal"
            value={nextRenewal ? new Date(nextRenewal).toLocaleDateString() : "—"}
            hint={nextRenewal ? "projected from observed cadence" : "no active subscriptions"}
          />
        </div>
      )}

      <InboxPanel accounts={accounts} plan={plan} scanState={scanState} onScan={onScan} />

      <ReviewQueue items={reviewItems} />

      {triageOpen && (
        <TriageWizard
          rows={rows.filter(
            (row) =>
              row.subscription.status === "active" || row.subscription.status === "possible",
          )}
          onClose={() => setTriageOpen(false)}
        />
      )}

      {/* Subscription list */}
      {listLoaded && rows.length === 0 ? (
        <EmptyState icon="❄️" title="No subscriptions found">
          We scanned your receipts and didn&rsquo;t find recurring charges — an empty result is a
          real result. Connect another inbox or re-scan after new receipts arrive.
        </EmptyState>
      ) : rows.length > 0 ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-1">
            {FILTERS.map((entry) => {
              const count =
                entry.key === "all"
                  ? rows.length
                  : rows.filter((row) => row.subscription.status === entry.key).length;
              if (entry.key !== "all" && count === 0) return null;
              return (
                <button
                  key={entry.key}
                  onClick={() => setFilter(entry.key)}
                  className={cx(
                    "cursor-pointer rounded-full px-3 py-1 text-sm transition-colors",
                    filter === entry.key
                      ? "bg-frost text-frost-ink font-semibold"
                      : "text-muted hover:bg-surface-2",
                  )}
                >
                  {entry.label} <span className="opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => (
              <SubscriptionCard key={row.subscription.id} row={row} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function monthlyCost(row: Row): number {
  if (row.subscription.status !== "active") return 0;
  return normalizedMonthly(
    minorToMajor(row.subscription.amountMinor, row.subscription.currency),
    row.subscription.cycle,
  );
}

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function SubscriptionCard({ row }: { row: Row }) {
  const sub = row.subscription;
  const domain = row.merchant?.domains?.[0] ?? null;
  const isActive = sub.status === "active";
  return (
    <Link href={`/dashboard/subscriptions/${sub.id}`} className="group">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <MerchantLogo name={sub.name} domain={domain} />
            <div>
              <div className="font-semibold leading-tight">{sub.name}</div>
              <div className="text-xs text-muted">{row.merchant?.category ?? "uncategorized"}</div>
            </div>
          </div>
          <StatusBadge status={sub.status} />
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="tnum text-xl font-bold">
              {formatMinor(sub.amountMinor, sub.currency)}
              <span className="text-sm font-normal text-muted">
                {" "}
                / {sub.status === "possible" ? "charge" : sub.cycle.replace("ly", "")}
              </span>
            </div>
            {isActive && sub.cycle !== "monthly" && (
              <div className="tnum text-xs text-muted">
                ≈ {money(monthlyCost(row), sub.currency)} / month
              </div>
            )}
          </div>
          {sub.nextRenewalAt && isActive && (
            <div className="text-right text-xs text-muted">
              renews
              <br />
              {new Date(sub.nextRenewalAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

type Account = { id: number; address: string; status: string; lastSyncedAt: Date | null };

function InboxPanel({
  accounts,
  plan,
  scanState,
  onScan,
}: {
  accounts: Account[];
  plan: string;
  scanState: ScanState;
  onScan: (accountId: number) => void;
}) {
  const scanning = scanState.running;
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Connected inboxes</h3>
          {accounts.length === 0 && (
            <p className="mt-1 max-w-lg text-sm text-muted">
              SubZero requests <strong>read-only</strong> Gmail access, only searches for receipts,
              and discards email bodies after processing.
            </p>
          )}
        </div>
        <a href="/api/google/connect">
          <Button variant={accounts.length === 0 ? "primary" : "secondary"}>
            + Connect Gmail (read-only)
          </Button>
        </a>
      </div>
      {accounts.map((account) => (
        <div
          key={account.id}
          className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm"
        >
          <span className="font-medium">{account.address}</span>
          <Badge variant={account.status === "active" ? "ok" : "muted"}>{account.status}</Badge>
          <span className="text-muted">
            {account.lastSyncedAt
              ? `last synced ${new Date(account.lastSyncedAt).toLocaleString()}`
              : "never scanned"}
          </span>
          {account.status === "active" && (plan !== "teaser" || !account.lastSyncedAt) && (
            <Button
              variant="secondary"
              className="ml-auto"
              disabled={scanning}
              onClick={() => onScan(account.id)}
            >
              {scanning ? "Scanning…" : account.lastSyncedAt ? "Re-scan" : "Scan 24 months"}
            </Button>
          )}
        </div>
      ))}
      {scanning && (
        <div className="mt-3">
          <ProgressBar
            value={
              scanState.total
                ? (scanState.processed / Math.max(1, scanState.total)) * 100
                : 8 // indeterminate start
            }
          />
          <p className="mt-1.5 text-sm text-muted">
            {scanState.total === null
              ? "Searching your receipts…"
              : `Processed ${scanState.processed} of ${scanState.total} receipt emails — results update as they're found.`}
          </p>
        </div>
      )}
      {scanState.error && <p className="mt-2 text-sm text-danger">{scanState.error}</p>}
      {plan === "teaser" && accounts.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Free scan: one inbox, one scan. Basic re-scans monthly; Pro syncs daily across unlimited
          inboxes.
        </p>
      )}
      {plan === "basic" && accounts.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Basic: 1 inbox, monthly re-scan. Pro: unlimited inboxes, daily sync + alerts.
        </p>
      )}
    </Card>
  );
}

type ReviewItem = {
  id: number;
  merchantName: string;
  amountMinor: number;
  currency: string;
  chargedAt: Date;
  sourceSubject: string | null;
  extractionConfidence: number | null;
};

function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const utils = trpc.useUtils();
  const approve = trpc.review.approve.useMutation({ onSettled: () => utils.invalidate() });
  const reject = trpc.review.reject.useMutation({ onSettled: () => utils.invalidate() });

  if (items.length === 0) return null;
  return (
    <Card className="mb-6">
      <h3 className="font-semibold">🔎 Needs your review ({items.length})</h3>
      <p className="mt-1 text-sm text-muted">
        The AI wasn&rsquo;t confident enough about these. Nothing counts as a subscription until you
        approve it.
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm"
          >
            <span className="font-medium">{item.merchantName}</span>
            <span className="tnum">{formatMinor(item.amountMinor, item.currency)}</span>
            <span className="text-muted">{new Date(item.chargedAt).toLocaleDateString()}</span>
            <span className="max-w-60 truncate text-muted" title={item.sourceSubject ?? undefined}>
              “{item.sourceSubject}”
            </span>
            <Badge variant="warn">{item.extractionConfidence}% sure</Badge>
            <span className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                disabled={approve.isPending}
                onClick={() => approve.mutate({ chargeId: item.id })}
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                disabled={reject.isPending}
                onClick={() => reject.mutate({ chargeId: item.id })}
              >
                Not a subscription
              </Button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
