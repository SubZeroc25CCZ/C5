"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/money";

export function DashboardClient() {
  const utils = trpc.useUtils();
  const subscriptionsQuery = trpc.subscriptions.list.useQuery();
  const reviewQuery = trpc.review.queue.useQuery();
  const accountsQuery = trpc.emailAccounts.list.useQuery();
  const planQuery = trpc.billing.plan.useQuery();

  const scan = trpc.emailAccounts.scan.useMutation({
    onSettled: () => utils.invalidate(),
  });
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const accounts = accountsQuery.data ?? [];
  const plan = planQuery.data?.plan ?? "free";

  return (
    <main>
      <h1>Your subscriptions</h1>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Connected inboxes</h3>
        {accounts.length === 0 && (
          <p className="muted">
            No inbox connected yet. SubZero requests <strong>read-only</strong> Gmail access and
            only searches for receipts — it never sees your whole mailbox, and email bodies are
            discarded after processing.
          </p>
        )}
        {accounts.map((account) => (
          <div
            key={account.id}
            style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "0.5rem" }}
          >
            <span>{account.address}</span>
            <span className={`badge ${account.status === "active" ? "active" : "muted"}`}>
              {account.status}
            </span>
            <span className="muted">
              {account.lastSyncedAt
                ? `last synced ${new Date(account.lastSyncedAt).toLocaleDateString()}`
                : "never scanned"}
            </span>
            {account.status === "active" && (
              <button
                className="secondary"
                disabled={scan.isPending}
                onClick={() => scan.mutate({ accountId: account.id, mode: "backfill" })}
              >
                {scan.isPending ? "Scanning…" : "Scan 24 months"}
              </button>
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
          <a href="/api/google/connect">
            <button className="primary">Connect Gmail (read-only)</button>
          </a>
          {plan === "free" && (
            <button className="secondary" onClick={() => checkout.mutate()} disabled={checkout.isPending}>
              Upgrade to Pro — unlimited inboxes + daily sync
            </button>
          )}
        </div>
        {scan.error && <p style={{ color: "#b91c1c" }}>{scan.error.message}</p>}
      </section>

      <Totals totals={subscriptionsQuery.data?.totals ?? []} />
      <ReviewQueue items={reviewQuery.data ?? []} />
      <SubscriptionList
        rows={subscriptionsQuery.data?.subscriptions ?? []}
        loaded={subscriptionsQuery.isSuccess}
      />
    </main>
  );
}

function Totals({
  totals,
}: {
  totals: Array<{ currency: string; monthly: number; yearly: number; activeCount: number }>;
}) {
  if (totals.length === 0) return null;
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>What you spend</h3>
      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        {totals.map((total) => (
          <div key={total.currency}>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>
              {new Intl.NumberFormat("en", { style: "currency", currency: total.currency }).format(
                total.monthly,
              )}
              <span className="muted" style={{ fontSize: "0.9rem" }}> / month</span>
            </div>
            <div className="muted">
              {new Intl.NumberFormat("en", { style: "currency", currency: total.currency }).format(
                total.yearly,
              )}{" "}
              per year · {total.activeCount} active
            </div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        Totals are per currency — we never convert with exchange rates we didn&rsquo;t observe.
      </p>
    </section>
  );
}

function ReviewQueue({
  items,
}: {
  items: Array<{
    id: number;
    merchantName: string;
    amountMinor: number;
    currency: string;
    chargedAt: string | Date;
    sourceSubject: string | null;
    extractionConfidence: number | null;
  }>;
}) {
  const utils = trpc.useUtils();
  const approve = trpc.review.approve.useMutation({ onSettled: () => utils.invalidate() });
  const reject = trpc.review.reject.useMutation({ onSettled: () => utils.invalidate() });

  if (items.length === 0) return null;
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Needs your review</h3>
      <p className="muted">
        The AI wasn&rsquo;t confident enough about these. Nothing here counts as a subscription
        until you approve it.
      </p>
      <table>
        <thead>
          <tr>
            <th>Merchant</th>
            <th>Amount</th>
            <th>Date</th>
            <th>From email</th>
            <th>Confidence</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.merchantName}</td>
              <td>{formatMinor(item.amountMinor, item.currency)}</td>
              <td>{new Date(item.chargedAt).toLocaleDateString()}</td>
              <td className="muted">{item.sourceSubject}</td>
              <td>{item.extractionConfidence}%</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button
                  className="secondary"
                  onClick={() => approve.mutate({ chargeId: item.id })}
                  disabled={approve.isPending}
                >
                  Approve
                </button>{" "}
                <button
                  className="secondary"
                  onClick={() => reject.mutate({ chargeId: item.id })}
                  disabled={reject.isPending}
                >
                  Not a subscription
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type SubscriptionRow = {
  subscription: {
    id: number;
    name: string;
    amountMinor: number;
    currency: string;
    cycle: "weekly" | "monthly" | "quarterly" | "yearly";
    status: string;
    nextRenewalAt: string | Date | null;
  };
  merchant: {
    cancelUrl: string | null;
    cancelMethod: "url" | "email" | "phone" | "unknown";
    difficulty: number;
  } | null;
};

function SubscriptionList({ rows, loaded }: { rows: SubscriptionRow[]; loaded: boolean }) {
  if (loaded && rows.length === 0) {
    // An empty state is a correct answer (§10.4).
    return (
      <section className="card">
        <h3 style={{ marginTop: 0 }}>No subscriptions found</h3>
        <p className="muted">
          We scanned your receipts and didn&rsquo;t find recurring charges. If you connect another
          inbox or new receipts arrive, they&rsquo;ll show up here.
        </p>
      </section>
    );
  }
  if (rows.length === 0) return null;

  const confirmed = rows.filter((row) => row.subscription.status !== "possible");
  const possible = rows.filter((row) => row.subscription.status === "possible");

  return (
    <>
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Subscriptions</h3>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Price</th>
              <th>Cycle</th>
              <th>Status</th>
              <th>Next renewal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {confirmed.map((row) => (
              <SubscriptionRowView key={row.subscription.id} row={row} />
            ))}
          </tbody>
        </table>
      </section>
      {possible.length > 0 && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Possible subscriptions</h3>
          <p className="muted">
            Seen once — one charge is evidence, not a subscription. These are not counted in your
            totals.
          </p>
          <table>
            <tbody>
              {possible.map((row) => (
                <SubscriptionRowView key={row.subscription.id} row={row} />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function SubscriptionRowView({ row }: { row: SubscriptionRow }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const utils = trpc.useUtils();
  const prepare = trpc.cancellations.prepare.useMutation();
  const markSent = trpc.cancellations.markSent.useMutation({ onSettled: () => utils.invalidate() });
  const ignore = trpc.subscriptions.setStatus.useMutation({ onSettled: () => utils.invalidate() });

  const sub = row.subscription;
  return (
    <>
      <tr>
        <td>{sub.name}</td>
        <td>{formatMinor(sub.amountMinor, sub.currency)}</td>
        <td>{sub.status === "possible" ? "—" : sub.cycle}</td>
        <td>
          <span className={`badge ${sub.status === "active" ? "active" : sub.status === "possible" ? "possible" : "muted"}`}>
            {sub.status === "cancellation_requested" ? "request sent — not yet confirmed" : sub.status.replace("_", " ")}
          </span>
        </td>
        <td>{sub.nextRenewalAt ? new Date(sub.nextRenewalAt).toLocaleDateString() : "—"}</td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button className="secondary" onClick={() => setShowEvidence((value) => !value)}>
            What we saw
          </button>{" "}
          {sub.status === "active" && (
            <>
              <button
                className="secondary"
                disabled={prepare.isPending}
                onClick={() => prepare.mutate({ subscriptionId: sub.id })}
              >
                Cancel…
              </button>{" "}
              <button
                className="secondary"
                onClick={() => ignore.mutate({ id: sub.id, status: "ignored" })}
              >
                Ignore
              </button>
            </>
          )}
        </td>
      </tr>
      {prepare.data && (
        <tr>
          <td colSpan={6}>
            <div style={{ background: "var(--bg)", padding: "1rem", borderRadius: 8 }}>
              <strong>Escape path for {sub.name}</strong>
              {prepare.data.cancelUrl && (
                <p>
                  Cancel online:{" "}
                  <a href={prepare.data.cancelUrl} target="_blank" rel="noreferrer">
                    {prepare.data.cancelUrl}
                  </a>
                </p>
              )}
              <p className="muted">
                Or send this email from your own address ({prepare.data.method} playbook
                {prepare.data.difficulty ? `, difficulty ${prepare.data.difficulty}/5` : ""}):
              </p>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  padding: "0.75rem",
                  borderRadius: 8,
                }}
              >
                {`Subject: ${prepare.data.draft.subject}\n\n${prepare.data.draft.body}`}
              </pre>
              <button
                className="primary"
                disabled={markSent.isPending}
                onClick={() => markSent.mutate({ requestId: prepare.data.requestId })}
              >
                I sent the request
              </button>{" "}
              <span className="muted">
                We&rsquo;ll mark it &ldquo;request sent&rdquo; — it becomes &ldquo;cancelled&rdquo;
                only when the provider confirms.
              </span>
            </div>
          </td>
        </tr>
      )}
      {showEvidence && <EvidenceRow subscriptionId={sub.id} />}
    </>
  );
}

function EvidenceRow({ subscriptionId }: { subscriptionId: number }) {
  const evidence = trpc.subscriptions.whatWeSaw.useQuery({ id: subscriptionId });
  return (
    <tr>
      <td colSpan={6}>
        <div style={{ background: "var(--bg)", padding: "0.75rem 1rem", borderRadius: 8 }}>
          <strong>What we saw</strong>
          {evidence.isLoading && <p className="muted">Loading…</p>}
          {evidence.data && evidence.data.length === 0 && (
            <p className="muted">No source emails recorded for this entry.</p>
          )}
          {evidence.data && evidence.data.length > 0 && (
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
              {evidence.data.map((item, index) => (
                <li key={index}>
                  {new Date(item.chargedAt).toLocaleDateString()} — “{item.subject}” (
                  {formatMinor(item.amountMinor, item.currency)}
                  {item.extractionConfidence === null
                    ? ", matched from merchant database"
                    : `, AI-extracted at ${item.extractionConfidence}% confidence`}
                  )
                </li>
              ))}
            </ul>
          )}
        </div>
      </td>
    </tr>
  );
}
