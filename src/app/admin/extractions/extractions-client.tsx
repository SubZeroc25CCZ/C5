"use client";

import { trpc } from "@/lib/trpc";
import { Badge, Card } from "@/components/ui";
import { formatMinor } from "@/lib/money";
import { AdminTable } from "../admin-ui";

// Admin 4.4 — extraction quality. What is on screen is the extracted fields
// plus the email's subject and date. Not "bodies hidden by default": bodies
// were discarded at processing time and no longer exist to show.

const BAND_ORDER = ["90-100", "80-89", "60-79", "0-59"];

export function ExtractionsClient() {
  const query = trpc.admin.extractions.useQuery({ limit: 100 });

  if (query.error) return <p className="text-sm text-danger">{query.error.message}</p>;
  const bands = query.data?.bands ?? [];
  const byBand = new Map(bands.map((band) => [band.band, band]));

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold">Confidence bands</h2>
        <p className="mt-0.5 text-sm text-muted">
          Charges at 80 and above are auto-accepted; below that a user must review one for it to
          survive. The reviewed share is what validates the threshold.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {BAND_ORDER.map((name) => {
            const band = byBand.get(name);
            const total = band?.total ?? 0;
            const reviewed = Number(band?.reviewed ?? 0);
            return (
              <div key={name} className="rounded-lg border border-line p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {name}
                </div>
                <div className="tnum mt-1 text-xl font-bold">{total}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {total === 0
                    ? "no extractions"
                    : Number(name.split("-")[0]) >= 80
                      ? "auto-accepted"
                      : `${reviewed} reviewed and kept`}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div>
        <h2 className="mb-2 font-semibold">Recent Stage 2 extractions</h2>
        <AdminTable
          head={["Merchant", "Amount", "Charged", "Subject", "Confidence", "Matched", "Reviewed"]}
          empty={!query.isPending && (query.data?.sample.length ?? 0) === 0}
        >
          {(query.data?.sample ?? []).map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-2.5 font-medium">{row.merchantName}</td>
              <td className="tnum px-4 py-2.5 whitespace-nowrap">
                {formatMinor(row.amountMinor, row.currency)}
              </td>
              <td className="tnum px-4 py-2.5 whitespace-nowrap text-muted">
                {row.chargedAt.toLocaleDateString()}
              </td>
              <td className="max-w-xs truncate px-4 py-2.5 text-muted" title={row.sourceSubject ?? ""}>
                {row.sourceSubject ?? "—"}
              </td>
              <td className="tnum px-4 py-2.5">
                <Badge
                  variant={
                    (row.confidence ?? 0) >= 80 ? "ok" : (row.confidence ?? 0) >= 60 ? "warn" : "danger"
                  }
                >
                  {row.confidence ?? "—"}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-muted">
                {row.matched === null ? "unmatched" : `merchant ${row.matched}`}
              </td>
              <td className="px-4 py-2.5 text-muted">
                {row.reviewedAt ? row.reviewedAt.toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </div>
  );
}
