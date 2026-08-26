"use client";

import { trpc } from "@/lib/trpc";
import { Card, Stat } from "@/components/ui";
import { FunnelRow, HealthLight, SignalBadge, type Health } from "./admin-ui";

// Admin 4.1 — system health, and the beta research numbers on the same
// screen. The research kit's thresholds live in RESEARCH_KIT.md §4; this is
// where the numbers they judge become visible.

const ACCURACY_LABELS: Record<string, string> = {
  all_of_them: "Yes, that's all of them",
  mostly: "Mostly — a few missing",
  missed_a_lot: "It missed a lot",
  found_forgotten: "Found things I'd forgotten",
  dismissed: "Dismissed the survey",
};

export function HealthClient() {
  const health = trpc.admin.health.useQuery();
  const plans = trpc.admin.plans.useQuery();

  if (health.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (health.error) return <p className="text-sm text-danger">{health.error.message}</p>;
  const data = health.data;

  const surveyTotal = Object.entries(data.survey)
    .filter(([key]) => key !== "dismissed")
    .reduce((sum, [, value]) => sum + value, 0);
  const forgotten = data.survey.found_forgotten ?? 0;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap gap-3">
        <Stat label="Users" value={data.counts.users} />
        <Stat
          label="Connected inboxes"
          value={data.counts.inboxesActive}
          hint={
            data.counts.inboxesErrored > 0
              ? `${data.counts.inboxesErrored} errored or revoked`
              : "all healthy"
          }
        />
        <Stat
          label="Scans (24h)"
          value={data.counts.scansToday}
          hint={`${Math.round(data.errorRate * 100)}% failed`}
        />
        <Stat
          label="Needs review"
          value={data.counts.reviewBacklog}
          hint="below the 0.8 threshold"
        />
        <Stat
          label="Merchants"
          value={data.counts.merchants}
          hint={`${data.counts.merchantsVerified} with a verified cancel URL`}
        />
      </section>

      <Card>
        <h2 className="font-semibold">Subsystems</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <HealthLight state={data.subsystems.scanning as Health} label="Scanning" />
          <HealthLight state={data.subsystems.inboxes as Health} label="Inbox connections" />
          <HealthLight state={data.subsystems.extraction as Health} label="Extraction queue" />
        </div>
        {data.scanDuration.meanMs !== null && (
          <p className="mt-3 text-xs text-muted">
            Successful scans in the last 24h averaged{" "}
            <span className="tnum">{Math.round(data.scanDuration.meanMs / 1000)}s</span>
            {data.scanDuration.slowestMs !== null && (
              <>
                , slowest{" "}
                <span className="tnum">{Math.round(data.scanDuration.slowestMs / 1000)}s</span>
              </>
            )}
            .
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Activation funnel</h2>
        <p className="mt-0.5 text-sm text-muted">
          Distinct users per step. The drop between any two steps is the number worth acting on.
        </p>
        <div className="mt-4 space-y-2">
          {data.funnel.map((entry, index) => (
            <FunnelRow
              key={entry.step}
              step={entry.step}
              users={entry.users}
              top={data.funnel[0]?.users ?? 0}
              previous={index === 0 ? null : (data.funnel[index - 1]?.users ?? null)}
            />
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Did the scan find what they expected?</h2>
          {surveyTotal === 0 ? (
            <p className="mt-3 text-sm text-muted">No survey responses yet.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5 text-sm">
                {Object.entries(ACCURACY_LABELS).map(([key, label]) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className={key === "dismissed" ? "text-muted" : undefined}>{label}</span>
                    <span className="tnum font-semibold">{data.survey[key] ?? 0}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                &ldquo;Found things I&rsquo;d forgotten&rdquo; is{" "}
                <span className="tnum font-semibold text-ink">
                  {Math.round((forgotten / surveyTotal) * 100)}%
                </span>{" "}
                of answers — the research kit&rsquo;s go/no-go threshold is 40%.
              </p>
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Action signals</h2>
          <p className="mt-0.5 text-sm text-muted">
            Provider-confirmed cancellations are the only event that proves SubZero worked.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {[
              ["cancellation_drafted", "Drafts prepared"],
              ["cancellation_sent", "Marked sent"],
              ["cancellation_confirmed", "Provider-confirmed"],
              ["subscription_corrected", "Corrections by users"],
              ["subscription_ignored", "Marked not mine"],
              ["aggregator_split", "Storefront receipts split"],
            ].map(([key, label]) => (
              <li key={key} className="flex items-center justify-between gap-3">
                <span>{label}</span>
                <SignalBadge count={data.signals[key!] ?? 0} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {plans.data && (
        <Card>
          <h2 className="font-semibold">Plans</h2>
          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            {Object.entries(plans.data.plans).map(([plan, value]) => (
              <div key={plan}>
                <div className="text-xs uppercase tracking-wide text-muted">{plan}</div>
                <div className="tnum text-lg font-bold">{value}</div>
              </div>
            ))}
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">subscriptions tracked</div>
              <div className="tnum text-lg font-bold">{plans.data.subscriptionsTracked}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
