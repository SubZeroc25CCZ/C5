"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/money";
import { Button, Card, MerchantLogo, ProgressBar, StatusBadge } from "@/components/ui";
import type { FullListPayload } from "./dashboard-client";

type Row = FullListPayload["subscriptions"][number];

type Decision = "keep" | "cancel" | "ignore";

/**
 * Post-scan triage: step through every found subscription and decide.
 * "Cancel" drafts the cancellation email (§ escape path); nothing is ever
 * cancelled silently — the user finishes each draft on the detail page.
 */
export function TriageWizard({ rows, onClose }: { rows: Row[]; onClose: () => void }) {
  const utils = trpc.useUtils();
  const setStatus = trpc.subscriptions.setStatus.useMutation();
  const prepare = trpc.cancellations.prepare.useMutation();

  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Array<{ row: Row; decision: Decision }>>([]);

  const done = index >= rows.length;
  const row = rows[index];

  async function decide(decision: Decision) {
    if (!row) return;
    setDecisions((prev) => [...prev, { row, decision }]);
    setIndex((i) => i + 1);
    // Fire the side effect without blocking the flow; errors surface via
    // the dashboard queries on close.
    if (decision === "ignore") {
      setStatus.mutate({ id: row.subscription.id, status: "ignored" });
    } else if (decision === "cancel") {
      prepare.mutate({ subscriptionId: row.subscription.id });
    }
  }

  function close() {
    utils.invalidate();
    onClose();
  }

  const toCancel = decisions.filter((entry) => entry.decision === "cancel");
  const ignored = decisions.filter((entry) => entry.decision === "ignore");
  const kept = decisions.filter((entry) => entry.decision === "keep");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg">
        {!done && row ? (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-muted">
              <span>
                Reviewing {index + 1} of {rows.length}
              </span>
              <button onClick={close} className="cursor-pointer hover:text-ink">
                Finish later ✕
              </button>
            </div>
            <ProgressBar value={(index / rows.length) * 100} />

            <div className="mt-6 flex items-center gap-4">
              <MerchantLogo
                name={row.subscription.name}
                domain={row.merchant?.domains?.[0] ?? null}
                size={52}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-xl font-bold">{row.subscription.name}</h3>
                  <StatusBadge status={row.subscription.status} />
                </div>
                <div className="text-sm text-muted">
                  {row.merchant?.category ?? "uncategorized"}
                </div>
              </div>
              <div className="tnum text-right">
                <div className="text-xl font-bold">
                  {formatMinor(row.subscription.amountMinor, row.subscription.currency)}
                </div>
                <div className="text-xs text-muted">
                  per{" "}
                  {row.subscription.status === "possible"
                    ? "charge (seen once)"
                    : row.subscription.cycle.replace("ly", "")}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => decide("keep")}>
                👍 Keep
              </Button>
              <Button variant="danger" onClick={() => decide("cancel")}>
                ✂️ Cancel this
              </Button>
              <Button variant="ghost" onClick={() => decide("ignore")}>
                🙈 Ignore
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              &ldquo;Cancel this&rdquo; drafts the cancellation email — nothing is sent without you.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold">Review complete 🎉</h3>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                👍 Keeping <strong>{kept.length}</strong>
              </li>
              <li>
                🙈 Ignored <strong>{ignored.length}</strong>
              </li>
              <li>
                ✂️ Cancelling <strong>{toCancel.length}</strong>
                {toCancel.length > 0 && (
                  <span className="text-muted">
                    {" "}
                    — worth{" "}
                    {summarize(toCancel.map((entry) => entry.row))} in observed charges
                  </span>
                )}
              </li>
            </ul>
            {toCancel.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted">
                  Drafts are ready — open each one to copy the email and mark it sent:
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {toCancel.map((entry) => (
                    <li key={entry.row.subscription.id}>
                      <Link
                        href={`/dashboard/subscriptions/${entry.row.subscription.id}`}
                        className="text-frost hover:underline"
                        onClick={onClose}
                      >
                        {entry.row.subscription.name} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button className="mt-5 w-full" onClick={close}>
              Back to dashboard
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

/** Per-currency sum of the reviewed rows' per-cycle amounts — observed only. */
function summarize(rows: Row[]): string {
  const byCurrency = new Map<string, number>();
  for (const row of rows) {
    const currency = row.subscription.currency;
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + row.subscription.amountMinor);
  }
  return [...byCurrency.entries()]
    .map(([currency, minor]) => formatMinor(minor, currency))
    .join(" + ");
}
