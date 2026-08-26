"use client";

import { Badge, Card, cx } from "@/components/ui";

// Small shared pieces for the admin panel. Admin screens are dense on
// purpose — this is an operator's console, not a customer surface — but they
// obey the same design laws: honest labels, no invented numbers, and a
// visible "no data yet" instead of a zero pretending to be a measurement.

export type Health = "green" | "amber" | "red";

const LIGHT: Record<Health, { className: string; label: string }> = {
  green: { className: "bg-ok", label: "healthy" },
  amber: { className: "bg-warn", label: "degraded" },
  red: { className: "bg-danger", label: "failing" },
};

export function HealthLight({ state, label }: { state: Health; label: string }) {
  const light = LIGHT[state];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cx("inline-block size-2.5 shrink-0 rounded-full", light.className)}
        aria-hidden
      />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted">{light.label}</span>
    </div>
  );
}

export function AdminTable({
  head,
  children,
  empty,
}: {
  head: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-muted">
          Nothing recorded yet — this fills in as the beta runs.
        </p>
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {head.map((cell) => (
              <th
                key={cell}
                className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </Card>
  );
}

/**
 * One funnel step. The bar is proportional to the FIRST step, so the shape
 * of the drop-off is the thing you see — the research kit calls this the
 * highest-value number in the business.
 */
export function FunnelRow({
  step,
  users,
  top,
  previous,
}: {
  step: string;
  users: number;
  top: number;
  previous: number | null;
}) {
  const width = top > 0 ? Math.round((users / top) * 100) : 0;
  // Conversion from the previous step, not from the top: "80% of the people
  // who connected an inbox finished a scan" is the actionable sentence.
  const conversion = previous && previous > 0 ? Math.round((users / previous) * 100) : null;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 text-sm">{step.replace(/_/g, " ")}</div>
      <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
        <div className="h-full rounded-md bg-frost" style={{ width: `${width}%` }} />
      </div>
      <div className="tnum w-12 shrink-0 text-right text-sm font-semibold">{users}</div>
      <div className="tnum w-20 shrink-0 text-right text-xs text-muted">
        {conversion === null ? "—" : `${conversion}% of prev`}
      </div>
    </div>
  );
}

export function SignalBadge({ count }: { count: number }) {
  return <Badge variant={count > 0 ? "frost" : "muted"}>{count}</Badge>;
}
