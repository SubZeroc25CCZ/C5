"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatMinor, minorToMajor } from "@/lib/money";
import { CHEAPEST_PAID, TEASER_BOUNDARY } from "@/lib/plans";
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
import { PostScanSurvey } from "./post-scan-survey";
import {
  CardsIcon,
  SearchIcon,
  LockIcon,
  SnowflakeIcon,
  SparkleIcon,
  TrendUpIcon,
} from "@/components/icons";

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

  const listFailed = listQuery.isError;
  const listLoading = listQuery.isLoading;

  // Funnel step (§3.1): results actually seen, recorded once per mount when
  // a scan has produced something to look at.
  const hasResults = data ? (data.teaser ? data.counts.total > 0 : data.subscriptions.length > 0) : false;
  const trackEvent = trpc.research.event.useMutation();
  const resultsSeen = useRef(false);
  useEffect(() => {
    if (hasResults && !resultsSeen.current) {
      resultsSeen.current = true;
      trackEvent.mutate({ name: "results_viewed" });
    }
  }, [hasResults, trackEvent]);

  if (listLoading) return <DashboardSkeleton />;

  if (listFailed) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Your subscriptions</h1>
        <Card className="py-10 text-center">
          <p className="font-semibold">We couldn&rsquo;t load your subscriptions.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Nothing is lost — this page just failed to fetch. Try again in a moment.
          </p>
          <div className="mt-4">
            <Button onClick={() => listQuery.refetch()}>Try again</Button>
          </div>
        </Card>
      </main>
    );
  }

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
        <LinkButton href="/pricing">
          <SparkleIcon width={16} height={16} /> Unlock everything
        </LinkButton>
      </div>

      {data.totals.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-4">
          {data.totals.map((total, index) => (
            <Stat
              key={total.currency}
              // Money is the hero: the primary currency total leads the
              // screen at ~2.5× body; secondary currencies stay side by
              // side at standard size (never merged — §10.1).
              hero={index === 0}
              label={`Monthly · ${total.currency}`}
              value={
                index === 0 ? (
                  <HeroMoney amount={total.monthly} currency={total.currency} />
                ) : (
                  money(total.monthly, total.currency)
                )
              }
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

      {hasResults && <PostScanSurvey />}

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
                {CHEAPEST_PAID.name} shows every subscription with evidence and price history,
                and prepares cancellations for the ones you don&rsquo;t want — from{" "}
                {CHEAPEST_PAID.monthly}/month.
              </p>
              <div className="mt-4">
                <LinkButton href="/pricing" className="px-6 py-2.5">
                  See plans
                </LinkButton>
              </div>
            </Card>
          )}
        </section>
      ) : scanState.running ? null : accounts.length === 0 ? (
        <EmptyState icon={<SnowflakeIcon width={36} height={36} className="text-frost" />} title="Your subscriptions will appear here">
          Connect a Gmail inbox above (read-only) and run the free scan — your per-currency
          totals, how many subscriptions we found, and your most expensive one in full detail.
        </EmptyState>
      ) : accounts.some((account) => account.lastSyncedAt) ? (
        // Scanned and found nothing — an empty result is a real result, and
        // it must not read like the scan never ran.
        <EmptyState icon={<SnowflakeIcon width={36} height={36} className="text-frost" />} title="No subscriptions found">
          We scanned your receipts and didn&rsquo;t find recurring charges — an empty result is a
          real result. Connect another inbox or re-scan after new receipts arrive.
        </EmptyState>
      ) : (
        <EmptyState icon={<SnowflakeIcon width={36} height={36} className="text-frost" />} title="Run your free scan">
          Start the scan above — results show up here, free: your per-currency totals, how many
          subscriptions we found, and your most expensive one in full detail.
        </EmptyState>
      )}
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
        <span className="text-frost"><LockIcon width={22} height={22} /></span>
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
            <CardsIcon width={16} height={16} /> Review one by one
          </Button>
        )}
        {plan !== "pro" && (
          <LinkButton variant="secondary" href="/pricing">
            <SparkleIcon width={16} height={16} /> Upgrade to Pro
          </LinkButton>
        )}
      </div>

      {/* Price-increase alerts — only observed changes, never predictions */}
      {alerts.length > 0 && (
        <Card className="mb-6 border-warn bg-warn-bg/40">
          <h3 className="flex items-center gap-2 font-semibold">
            <TrendUpIcon width={16} height={16} className="text-warn" /> Price increases spotted
          </h3>
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
          {totals.map((total, index) => (
            <Stat
              key={total.currency}
              // Money is the hero: one number leads the screen (D10 B2).
              hero={index === 0}
              label={`Monthly · ${total.currency}`}
              value={
                index === 0 ? (
                  <HeroMoney amount={total.monthly} currency={total.currency} />
                ) : (
                  money(total.monthly, total.currency)
                )
              }
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

      {rows.length > 0 && <PostScanSurvey />}

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
      {listLoaded && rows.length === 0 && accounts.length === 0 ? (
        <EmptyState icon={<SnowflakeIcon width={36} height={36} className="text-frost" />} title="Your subscriptions will appear here">
          Connect a Gmail inbox above (read-only) and run a scan — every recurring charge we can
          evidence shows up here, with receipts attached.
        </EmptyState>
      ) : listLoaded && rows.length === 0 ? (
        <EmptyState icon={<SnowflakeIcon width={36} height={36} className="text-frost" />} title="No subscriptions found">
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
                    "cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors duration-200",
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

/**
 * One-time count-up for the hero number (D10 B4): the monthly total sweeps
 * to its value on first paint — money is the hero, so the money gets the
 * only entrance. Runs once per mount, never on refetches, and collapses to
 * the final value under prefers-reduced-motion.
 */
function useCountUpOnce(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const played = useRef(false);
  useEffect(() => {
    if (played.current) {
      setValue(target);
      return;
    }
    played.current = true;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

/** The hero stat's value: counted up once, tabular so nothing jitters. */
function HeroMoney({ amount, currency }: { amount: number; currency: string }) {
  const animated = useCountUpOnce(amount);
  return <>{money(animated, currency)}</>;
}

/** Loading is a skeleton of the real layout, never a spinner (design law 4). */
function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8" aria-busy="true" aria-label="Loading your subscriptions">
      <div className="mb-6 h-8 w-60 animate-pulse rounded-lg bg-surface-2" />
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="h-28 min-w-44 flex-1 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-28 min-w-44 flex-1 animate-pulse rounded-xl bg-surface-2" />
      </div>
      <div className="mb-6 h-24 animate-pulse rounded-xl bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
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
  const unconfirmed = sub.status === "possible";

  // D6: storefront aggregators (Apple, Google, PayPal, …) show observed
  // spend, never a per-month claim — the basket varies by receipt.
  if (row.aggregator) {
    return (
      <Link href={`/dashboard/subscriptions/${sub.id}`} className="group">
        <Card className="h-full border-dashed transition-shadow group-hover:shadow-elev-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <MerchantLogo name={sub.name} domain={domain} />
              <div>
                <div className="font-semibold leading-tight">{sub.name}</div>
                <div className="text-xs text-muted">storefront charges</div>
              </div>
            </div>
            <Badge variant="muted">
              {row.evidenceCount} receipt{row.evidenceCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="mt-4">
            <div className="tnum text-xl font-bold">
              {formatMinor(row.observedTotalMinor, sub.currency)}
              <span className="text-sm font-normal text-muted"> observed</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Bills many services together — amounts vary, so this is observed spend, not a
              monthly price.
            </p>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/dashboard/subscriptions/${sub.id}`} className="group">
      <Card className="h-full transition-shadow group-hover:shadow-elev-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <MerchantLogo name={sub.name} domain={domain} />
            <div>
              <div className="font-semibold leading-tight">{sub.name}</div>
              <div className="text-xs text-muted">{row.merchant?.category ?? "uncategorized"}</div>
            </div>
          </div>
          {/* D6: the badge equals the evidence count — never "seen once" with
              a pile of receipts behind it. */}
          {unconfirmed ? (
            <Badge variant="warn">
              {row.evidenceCount === 1 ? "seen once" : `seen ${row.evidenceCount}×`}
            </Badge>
          ) : (
            <StatusBadge status={sub.status} />
          )}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            {unconfirmed ? (
              // D6: no "/month" (or any cycle) for unconfirmed recurrence —
              // observed spend only, and it never joins the monthly total.
              <>
                <div className="tnum text-xl font-bold">
                  {formatMinor(row.observedTotalMinor, sub.currency)}
                  <span className="text-sm font-normal text-muted"> observed</span>
                </div>
                <div className="tnum text-xs text-muted">
                  {row.evidenceCount === 1
                    ? `${formatMinor(sub.amountMinor, sub.currency)} per charge`
                    : `${row.evidenceCount} charges · no regular cycle yet`}
                </div>
              </>
            ) : (
              <>
                <div className="tnum text-xl font-bold">
                  {formatMinor(sub.amountMinor, sub.currency)}
                  <span className="text-sm font-normal text-muted">
                    {" "}
                    / {sub.cycle.replace("ly", "")}
                  </span>
                </div>
                {isActive && sub.cycle !== "monthly" && (
                  <div className="tnum text-xs text-muted">
                    ≈ {money(monthlyCost(row), sub.currency)} / month
                  </div>
                )}
              </>
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
          {/* D10 A3: say what the free scan does and does not show BEFORE
              the consent screen, never after it. */}
          {accounts.length === 0 && plan === "teaser" && (
            <p className="mt-1.5 max-w-lg text-sm text-muted">{TEASER_BOUNDARY}</p>
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
      <h3 className="flex items-center gap-2 font-semibold">
        <SearchIcon width={16} height={16} className="text-frost" /> Needs your review ({items.length})
      </h3>
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
