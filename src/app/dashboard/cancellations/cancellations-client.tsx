"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatMinor, majorToMinor, minorToMajor } from "@/lib/money";
import { normalizedMonthly, round2, type BillingCycle } from "@/engine/normalize";
import { gmailComposeHref, mailtoHref } from "@/lib/mail-links";
import { Badge, Button, Card, EmptyState, MerchantLogo, cx } from "@/components/ui";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type RequestRow = inferRouterOutputs<AppRouter>["cancellations"]["list"][number];

const DAY_MS = 86_400_000;

function monthlyMinor(row: RequestRow): number {
  const major = normalizedMonthly(
    minorToMajor(row.subscription.amountMinor, row.subscription.currency),
    row.subscription.cycle as BillingCycle,
  );
  return majorToMinor(round2(major), row.subscription.currency);
}

/** Per-currency totals — never merged across currencies (design law 3). */
function totalsByCurrency(rows: RequestRow[]): Array<{ currency: string; amountMinor: number }> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const currency = row.subscription.currency;
    map.set(currency, (map.get(currency) ?? 0) + monthlyMinor(row));
  }
  return [...map.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

function daysSince(date: Date | string | null): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS);
}

function TotalLine({ rows, label }: { rows: RequestRow[]; label: string }) {
  const totals = totalsByCurrency(rows);
  if (totals.length === 0) return null;
  return (
    <span className="text-sm text-muted">
      {label}{" "}
      <span className="tnum font-semibold text-ink">
        {totals.map((t) => formatMinor(t.amountMinor, t.currency)).join(" + ")}
      </span>
      /month
    </span>
  );
}

export function CancellationsClient({ accountEmail }: { accountEmail: string }) {
  const utils = trpc.useUtils();
  const planQuery = trpc.billing.plan.useQuery();
  const listQuery = trpc.cancellations.list.useQuery();
  const markSent = trpc.cancellations.markSent.useMutation({
    onSettled: () => utils.cancellations.invalidate(),
  });
  const confirm = trpc.cancellations.confirm.useMutation({
    onSettled: () => utils.cancellations.invalidate(),
  });

  const rows = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const drafts = rows.filter((r) => r.status === "draft");
  const sent = rows.filter((r) => r.status === "request_sent");
  const confirmed = rows.filter((r) => r.status === "provider_confirmed");

  if (listQuery.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      </main>
    );
  }
  if (planQuery.data?.plan === "teaser") {
    // Cancellation tools are Basic+ (D5) — the server returns nothing here.
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
          Cancellation tools come with Basic
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Prepared cancellation emails, verified cancel links, and honest tracking from draft to
          provider-confirmed — from $2.99/month.
        </p>
        <div className="mt-6">
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-lg bg-frost px-6 py-3 text-sm font-semibold text-frost-ink hover:bg-frost-strong"
          >
            See plans
          </Link>
        </div>
      </main>
    );
  }
  if (listQuery.isError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-bold">Couldn&rsquo;t load your cancellations</h1>
        <p className="mt-2 text-sm text-muted">Something went wrong on our side.</p>
        <Button className="mt-4" onClick={() => listQuery.refetch()}>
          Try again
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Cancellation center</h1>
          <p className="mt-1 text-sm text-muted">
            Draft → request sent → provider confirmed. Only the provider&rsquo;s confirmation
            counts as cancelled.
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <TotalLine rows={confirmed} label="Money freed:" />
          <TotalLine rows={[...drafts, ...sent]} label="At stake:" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10">
          <EmptyState icon="🧊" title="Nothing in the pipeline yet">
            Pick a subscription on your{" "}
            <Link href="/dashboard" className="font-medium text-frost">
              dashboard
            </Link>{" "}
            and choose “Prepare cancellation” — the draft lands here.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
          <BoardColumn title="Draft" count={drafts.length}>
            {drafts.map((row) => (
              <DraftCard
                key={row.id}
                row={row}
                accountEmail={accountEmail}
                onSent={(edited) =>
                  markSent.mutate({ requestId: row.id, ...edited })
                }
                sending={markSent.isPending}
              />
            ))}
          </BoardColumn>
          <BoardColumn title="Request sent" count={sent.length}>
            {sent.map((row) => (
              <SentCard
                key={row.id}
                row={row}
                accountEmail={accountEmail}
                onConfirm={() => confirm.mutate({ requestId: row.id })}
                confirming={confirm.isPending}
              />
            ))}
          </BoardColumn>
          <BoardColumn title="Provider confirmed" count={confirmed.length}>
            {confirmed.map((row) => (
              <ConfirmedCard key={row.id} row={row} />
            ))}
          </BoardColumn>
        </div>
      )}
    </main>
  );
}

function BoardColumn({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface-2/50 p-3">
      <h2 className="flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
        <span className="tnum">{count}</span>
      </h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function CardHeader({ row }: { row: RequestRow }) {
  return (
    <div className="flex items-center gap-3">
      <MerchantLogo name={row.subscription.name} domain={row.merchant?.domains?.[0]} size={32} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/subscriptions/${row.subscription.id}`}
          className="block truncate font-semibold hover:text-frost"
        >
          {row.subscription.name}
        </Link>
        <div className="tnum text-xs text-muted">
          {formatMinor(monthlyMinor(row), row.subscription.currency)}/month at stake
        </div>
      </div>
    </div>
  );
}

function DraftCard({
  row,
  accountEmail,
  onSent,
  sending,
}: {
  row: RequestRow;
  accountEmail: string;
  onSent: (edited: { draftSubject: string; draftBody: string }) => void;
  sending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(row.draftSubject ?? "");
  const [body, setBody] = useState(row.draftBody ?? "");
  const [copied, setCopied] = useState(false);
  const to = row.merchant?.cancelEmail ?? null;
  const draft = { to, subject, body };

  return (
    <Card className="p-4">
      <CardHeader row={row} />
      {!open ? (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setOpen(true)}>
          Open draft
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs"
            aria-label="Email subject"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs leading-relaxed"
            aria-label="Email body"
          />
          {!to && (
            <p className="text-xs text-warn">
              We don&rsquo;t know this merchant&rsquo;s cancellation address yet — check their
              website or a recent receipt for a support email.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href={mailtoHref(draft)}
              className="rounded-lg bg-frost px-3 py-1.5 text-xs font-semibold text-frost-ink hover:bg-frost-strong"
            >
              Open in email app
            </a>
            <a
              href={gmailComposeHref(draft)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-frost px-3 py-1.5 text-xs font-medium text-frost hover:bg-frost-soft"
            >
              Open in Gmail
            </a>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(`Subject: ${subject}\n\n${body}`).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="border-t border-line pt-2">
            <p className="text-xs text-muted">
              Sent it from your own address ({accountEmail})?
            </p>
            <Button
              className="mt-1.5 w-full"
              disabled={sending}
              onClick={() => onSent({ draftSubject: subject, draftBody: body })}
            >
              I sent it — track the request
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function SentCard({
  row,
  accountEmail,
  onConfirm,
  confirming,
}: {
  row: RequestRow;
  accountEmail: string;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const silentDays = daysSince(row.sentAt ?? row.createdAt);
  const sentDate = new Date(row.sentAt ?? row.createdAt).toISOString().slice(0, 10);
  const followUp = {
    to: row.merchant?.cancelEmail ?? null,
    subject: `Follow-up: ${row.draftSubject ?? "cancellation request"}`,
    body: `Hello ${row.subscription.name} team,\n\nOn ${sentDate} I requested cancellation of my ${row.subscription.name} subscription (account: ${accountEmail}) and asked for written confirmation. I have not received a reply.\n\nPlease confirm that the subscription is cancelled and that no further charges will be made. If it has not been cancelled, treat this email as that request, effective immediately.\n\nThank you,`,
  };

  return (
    <Card className="p-4">
      <CardHeader row={row} />
      <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">
        <span className="tnum">
          {silentDays === 0 ? "Sent today" : `${silentDays} day${silentDays === 1 ? "" : "s"} since request`}
        </span>
        {silentDays >= 14 ? (
          <Badge variant="danger">no reply — chase it</Badge>
        ) : silentDays >= 7 ? (
          <Badge variant="warn">worth a follow-up</Badge>
        ) : null}
      </div>
      <div className={cx("mt-3 flex flex-col gap-2", silentDays >= 7 && "rounded-lg")}>
        {silentDays >= 7 && (
          <a
            href={mailtoHref(followUp)}
            className="rounded-lg border border-frost px-3 py-1.5 text-center text-xs font-medium text-frost hover:bg-frost-soft"
          >
            Send a follow-up
          </a>
        )}
        <Button
          variant="secondary"
          className="w-full"
          disabled={confirming}
          onClick={onConfirm}
        >
          Provider confirmed the cancellation
        </Button>
        <p className="text-center text-[11px] text-muted">
          Only mark this once you have their confirmation — we don&rsquo;t pretend.
        </p>
      </div>
    </Card>
  );
}

function ConfirmedCard({ row }: { row: RequestRow }) {
  return (
    <Card className="p-4">
      <CardHeader row={row} />
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <Badge variant="ok">cancelled — provider confirmed</Badge>
        {row.confirmedAt && (
          <span className="text-muted">
            {new Date(row.confirmedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <p className="tnum mt-2 text-sm font-semibold text-ok">
        {formatMinor(monthlyMinor(row), row.subscription.currency)}/month freed
      </p>
    </Card>
  );
}
