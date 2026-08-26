"use client";

import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui";
import { AdminTable } from "../admin-ui";

// Admin 4.12 — the audit log viewer. Read-only by construction: no router
// procedure deletes or edits a row, so there is nothing for this screen to
// offer beyond reading. Every sensitive admin action appears here because
// each one writes the row before it completes.

export function AuditClient() {
  const log = trpc.admin.auditLog.useQuery({ limit: 150 });

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold">Append-only</h2>
        <p className="mt-0.5 text-sm text-muted">
          Nothing in SubZero deletes from this log. Entries carry the acting administrator, the
          action, its target and a short summary — never tokens, never email content.
        </p>
      </Card>

      {log.error && <p className="text-sm text-danger">{log.error.message}</p>}

      <AdminTable
        head={["When", "Administrator", "Action", "Target", "Detail"]}
        empty={!log.isPending && (log.data?.length ?? 0) === 0}
      >
        {(log.data ?? []).map((entry) => (
          <tr key={entry.id}>
            <td className="tnum px-4 py-2.5 whitespace-nowrap text-muted">
              {entry.createdAt.toLocaleString()}
            </td>
            <td className="px-4 py-2.5 font-mono text-xs">{entry.actorUserId.slice(0, 12)}…</td>
            <td className="px-4 py-2.5 font-medium">{entry.action}</td>
            <td className="px-4 py-2.5 text-muted">{entry.target ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{entry.detail ?? "—"}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
