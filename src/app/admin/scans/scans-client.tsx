"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge, cx } from "@/components/ui";
import { AdminTable } from "../admin-ui";

// Admin 4.2 — every scan run. Metadata only: a pseudonymized user id, the
// inbox's domain (never the customer's full address), duration, counts, and
// which stage failed. There is nothing here that could show email content,
// because email content does not exist after a scan (security rule 1).

const FILTERS = ["all", "failed", "running", "succeeded"] as const;

function shortId(userId: string) {
  // Pseudonymized: enough to correlate two rows, not enough to identify.
  return userId.length > 12 ? `${userId.slice(0, 10)}…` : userId;
}

function duration(ms: number | null) {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function ScansClient() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("all");
  const scans = trpc.admin.scans.useQuery({ status, limit: 100 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setStatus(filter)}
            className={cx(
              "cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors duration-200",
              status === filter
                ? "border-frost bg-frost-soft font-medium text-ink"
                : "border-line text-muted hover:border-frost hover:text-ink",
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {scans.error && <p className="text-sm text-danger">{scans.error.message}</p>}

      <AdminTable
        head={["Started", "User", "Inbox", "Mode", "Status", "Messages", "Found", "Duration"]}
        empty={!scans.isPending && (scans.data?.length ?? 0) === 0}
      >
        {(scans.data ?? []).map((run) => (
          <tr key={run.id} className="align-top">
            <td className="tnum px-4 py-2.5 whitespace-nowrap text-muted">
              {run.startedAt.toLocaleString()}
            </td>
            <td className="px-4 py-2.5 font-mono text-xs">{shortId(run.userId)}</td>
            <td className="px-4 py-2.5 text-muted">{run.inboxDomain ?? "—"}</td>
            <td className="px-4 py-2.5">
              {run.mode}
              {run.trigger !== "user" && (
                <span className="ml-1 text-xs text-muted">({run.trigger})</span>
              )}
            </td>
            <td className="px-4 py-2.5">
              {run.status === "succeeded" && <Badge variant="ok">succeeded</Badge>}
              {run.status === "running" && <Badge variant="warn">running</Badge>}
              {run.status === "failed" && (
                <div className="space-y-1">
                  <Badge variant="danger">failed at {run.failedStage ?? "?"}</Badge>
                  {run.error && (
                    <div className="max-w-xs text-xs break-words text-muted">{run.error}</div>
                  )}
                </div>
              )}
            </td>
            <td className="tnum px-4 py-2.5">{run.messagesTouched}</td>
            <td className="tnum px-4 py-2.5">{run.chargesFound}</td>
            <td className="tnum px-4 py-2.5 whitespace-nowrap">{duration(run.durationMs)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
