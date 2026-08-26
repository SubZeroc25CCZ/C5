"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/money";
import {
  Badge,
  Button,
  Card,
  DifficultyMeter,
  LinkButton,
  MerchantLogo,
  StatusBadge,
} from "@/components/ui";

export function SubscriptionDetailClient({ id }: { id: number }) {
  const utils = trpc.useUtils();
  const detail = trpc.subscriptions.get.useQuery({ id });
  const setStatus = trpc.subscriptions.setStatus.useMutation({ onSettled: () => utils.invalidate() });
  const update = trpc.subscriptions.update.useMutation({
    onSettled: () => utils.invalidate(),
    onSuccess: () => setEditing(false),
  });
  const prepare = trpc.cancellations.prepare.useMutation({ onSettled: () => utils.invalidate() });
  const markSent = trpc.cancellations.markSent.useMutation({ onSettled: () => utils.invalidate() });
  const confirm = trpc.cancellations.confirm.useMutation({ onSettled: () => utils.invalidate() });

  const [editing, setEditing] = useState(false);

  if (detail.isLoading) {
    return <main className="mx-auto max-w-4xl px-4 py-8 text-muted">Loading…</main>;
  }
  if (!detail.data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted">Subscription not found.</p>
        <Link href="/dashboard" className="text-frost hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const { subscription: sub, merchant, evidence, priceChanges, cancellationRequests } = detail.data;
  const domain = merchant?.domains?.[0] ?? null;
  const latestRequest = cancellationRequests[0];

  // Merge charges and price changes into one chronological story.
  const timeline = [
    ...evidence.map((charge) => ({
      kind: "charge" as const,
      at: new Date(charge.chargedAt),
      charge,
    })),
    ...priceChanges.map((change) => ({
      kind: "price" as const,
      at: new Date(change.observedAt),
      change,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
        ← All subscriptions
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <MerchantLogo name={sub.name} domain={domain} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{sub.name}</h1>
            <StatusBadge status={sub.status} />
            {sub.confidence !== null && sub.status === "active" && (
              <Badge variant="frost">{sub.confidence}% match</Badge>
            )}
          </div>
          <div className="text-sm text-muted">
            {merchant?.category ?? "uncategorized"}
            {domain && <> · {domain}</>}
          </div>
        </div>
        <div className="tnum text-right">
          <div className="text-2xl font-bold">{formatMinor(sub.amountMinor, sub.currency)}</div>
          <div className="text-sm text-muted">per {sub.cycle.replace("ly", "")}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEditing((value) => !value)}>
          ✏️ Edit details
        </Button>
        {sub.status === "active" && (
          <Button
            variant="ghost"
            onClick={() => setStatus.mutate({ id: sub.id, status: "ignored" })}
          >
            Ignore
          </Button>
        )}
        {sub.status === "ignored" && (
          <Button
            variant="ghost"
            onClick={() => setStatus.mutate({ id: sub.id, status: "active" })}
          >
            Restore
          </Button>
        )}
      </div>

      {editing && (
        <EditForm
          initial={sub}
          pending={update.isPending}
          onSave={(fields) => update.mutate({ id: sub.id, ...fields })}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Escape path */}
      {(sub.status === "active" || sub.status === "cancellation_requested") && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">🚪 Escape path</h3>
            {merchant && (
              <span className="flex items-center gap-2 text-sm text-muted">
                difficulty <DifficultyMeter level={merchant.difficulty} />
              </span>
            )}
          </div>

          {merchant?.cancelUrl && (
            <p className="mt-2 text-sm">
              Cancel online:{" "}
              <a
                href={merchant.cancelUrl}
                target="_blank"
                rel="noreferrer"
                className="text-frost hover:underline"
              >
                {merchant.cancelUrl}
              </a>
            </p>
          )}

          {!latestRequest && (
            <div className="mt-3">
              <Button onClick={() => prepare.mutate({ subscriptionId: sub.id })} disabled={prepare.isPending}>
                {prepare.isPending ? "Drafting…" : "Prepare cancellation email"}
              </Button>
              <p className="mt-2 text-xs text-muted">
                We draft it, you send it from your own address — SubZero never sends email for you.
              </p>
            </div>
          )}

          {latestRequest && (
            <div className="mt-4">
              <CancellationTracker status={latestRequest.status} />
              {latestRequest.status === "draft" && (
                <>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm">
                    {`Subject: ${latestRequest.draftSubject}\n\n${latestRequest.draftBody}`}
                  </pre>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => markSent.mutate({ requestId: latestRequest.id })}
                      disabled={markSent.isPending}
                    >
                      I sent the request
                    </Button>
                    <span className="text-xs text-muted">
                      Copy the draft into an email from your own address first.
                    </span>
                  </div>
                </>
              )}
              {latestRequest.status === "request_sent" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => confirm.mutate({ requestId: latestRequest.id })}
                    disabled={confirm.isPending}
                  >
                    The provider confirmed ✓
                  </Button>
                  <span className="text-xs text-muted">
                    Sent {latestRequest.sentAt ? new Date(latestRequest.sentAt).toLocaleDateString() : ""} —
                    only a provider confirmation makes it &ldquo;cancelled.&rdquo;
                  </span>
                </div>
              )}
              {latestRequest.status === "provider_confirmed" && (
                <p className="mt-2 text-sm text-ok">
                  Confirmed by the provider
                  {latestRequest.confirmedAt
                    ? ` on ${new Date(latestRequest.confirmedAt).toLocaleDateString()}`
                    : ""}
                  . 🎉
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* What we saw — the evidence timeline (§6) */}
      <Card className="mt-6">
        <h3 className="text-lg font-semibold">📜 What we saw</h3>
        <p className="mt-1 text-sm text-muted">
          Every fact on this page traces back to these emails. We keep only date, subject, and the
          extracted amount — never the email body.
        </p>
        {timeline.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No source emails recorded for this entry.</p>
        ) : (
          <ol className="mt-4 space-y-0 border-l-2 border-line pl-4">
            {timeline.map((item, index) => (
              <li key={index} className="relative pb-4">
                <span
                  className={`absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full ${
                    item.kind === "price" ? "bg-warn" : "bg-frost"
                  }`}
                />
                {item.kind === "charge" ? (
                  <div className="text-sm">
                    <span className="tnum font-semibold">
                      {formatMinor(item.charge.amountMinor, item.charge.currency)}
                    </span>{" "}
                    <span className="text-muted">on {item.at.toLocaleDateString()}</span>
                    <div className="truncate text-muted" title={item.charge.sourceSubject ?? undefined}>
                      “{item.charge.sourceSubject}”
                    </div>
                    <div className="text-xs text-muted">
                      {item.charge.extractionConfidence === null
                        ? "matched from merchant database"
                        : `AI-extracted at ${item.charge.extractionConfidence}% confidence`}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    <Badge variant="warn">price change</Badge>{" "}
                    <span className="tnum">
                      {formatMinor(item.change.oldAmountMinor, item.change.currency)} →{" "}
                      <strong>{formatMinor(item.change.newAmountMinor, item.change.currency)}</strong>
                    </span>{" "}
                    <span className="text-muted">observed {item.at.toLocaleDateString()}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </main>
  );
}

function CancellationTracker({ status }: { status: string }) {
  const steps = [
    { key: "draft", label: "Draft" },
    { key: "request_sent", label: "Request sent" },
    { key: "provider_confirmed", label: "Provider confirmed" },
  ];
  const currentIndex = steps.findIndex((step) => step.key === status);
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      {steps.map((step, index) => (
        <span key={step.key} className="flex items-center gap-2">
          {index > 0 && <span className="h-px w-6 bg-line" />}
          <span
            className={
              index <= currentIndex
                ? "rounded-full bg-frost px-2.5 py-1 text-frost-ink"
                : "rounded-full bg-surface-2 px-2.5 py-1 text-muted"
            }
          >
            {step.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function EditForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: { name: string; amountMinor: number; currency: string; cycle: string };
  pending: boolean;
  onSave: (fields: {
    name: string;
    amountMinor: number;
    currency: string;
    cycle: "weekly" | "monthly" | "quarterly" | "yearly";
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState((initial.amountMinor / 100).toFixed(2));
  const [currency, setCurrency] = useState(initial.currency);
  const [cycle, setCycle] = useState(initial.cycle);

  const inputClass =
    "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm focus:border-frost focus:outline-none";

  return (
    <Card className="mt-4">
      <h3 className="font-semibold">Edit details</h3>
      <p className="mt-1 text-xs text-muted">
        Every AI-extracted field is yours to correct — edits never touch the source emails.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted">
          Name
          <input className={`${inputClass} mt-1 block w-44`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-xs font-medium text-muted">
          Amount
          <input
            className={`${inputClass} tnum mt-1 block w-28`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Currency
          <input
            className={`${inputClass} mt-1 block w-20 uppercase`}
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-muted">
          Cycle
          <select className={`${inputClass} mt-1 block`} value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
            <option value="yearly">yearly</option>
          </select>
        </label>
        <Button
          disabled={pending || !name || Number.isNaN(Number.parseFloat(amount))}
          onClick={() =>
            onSave({
              name,
              amountMinor: Math.round(Number.parseFloat(amount) * 100),
              currency: currency.toUpperCase(),
              cycle: cycle as "weekly" | "monthly" | "quarterly" | "yearly",
            })
          }
        >
          Save
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
