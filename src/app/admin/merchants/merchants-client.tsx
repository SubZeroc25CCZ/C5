"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge, Button, Card, DifficultyMeter, cx } from "@/components/ui";
import { AdminTable } from "../admin-ui";

// Admin 4.6 — the merchant directory. The rule this screen exists to enforce:
// an unverified cancel URL never renders to a customer. Publishing one here
// therefore demands a source note (§4.7), and both the URL and the note are
// written to the audit log before the change lands.

type Row = {
  id: number;
  name: string;
  slug: string;
  category: string;
  cancelUrl: string | null;
  cancelMethod: string;
  cancelEmail: string | null;
  difficulty: number;
  cancelUrlVerifiedAt: Date | null;
  cancelUrlVerifiedBy: string | null;
  cancelUrlSource: string | null;
};

function EditRow({ merchant, onDone }: { merchant: Row; onDone: () => void }) {
  const utils = trpc.useUtils();
  const [cancelUrl, setCancelUrl] = useState(merchant.cancelUrl ?? "");
  const [source, setSource] = useState("");
  const [difficulty, setDifficulty] = useState(merchant.difficulty);
  const update = trpc.admin.updateMerchant.useMutation({
    onSuccess: async () => {
      await utils.admin.merchants.invalidate();
      onDone();
    },
  });

  const urlChanged = cancelUrl.trim() !== (merchant.cancelUrl ?? "");
  const needsSource = urlChanged && cancelUrl.trim().length > 0;

  return (
    <tr className="bg-surface-2/60">
      <td colSpan={6} className="px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Cancel URL</span>
            <input
              value={cancelUrl}
              onChange={(event) => setCancelUrl(event.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">
              Verification source {needsSource && <span className="text-danger">*</span>}
            </span>
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Where you confirmed this link works"
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Difficulty (1 easy – 5 hostile)</span>
            <input
              type="number"
              min={1}
              max={5}
              value={difficulty}
              onChange={(event) => setDifficulty(Number(event.target.value))}
              className="mt-1 w-24 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            />
          </label>
        </div>

        {update.error && <p className="mt-2 text-sm text-danger">{update.error.message}</p>}

        <div className="mt-3 flex items-center gap-3">
          <Button
            disabled={update.isPending || (needsSource && source.trim().length < 3)}
            onClick={() =>
              update.mutate({
                id: merchant.id,
                ...(urlChanged
                  ? { cancelUrl: cancelUrl.trim() === "" ? null : cancelUrl.trim() }
                  : {}),
                ...(needsSource ? { verificationSource: source.trim() } : {}),
                ...(difficulty !== merchant.difficulty ? { difficulty } : {}),
              })
            }
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <button
            onClick={onDone}
            className="cursor-pointer text-sm text-muted transition-colors duration-200 hover:text-ink"
          >
            Cancel
          </button>
          {needsSource && (
            <span className="text-xs text-muted">
              A URL with no source note stays invisible to customers.
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function MerchantsClient() {
  const [query, setQuery] = useState("");
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const merchants = trpc.admin.merchants.useQuery({ query, onlyUnverified, limit: 100 });

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search merchants…"
            className="min-w-56 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
          <button
            onClick={() => setOnlyUnverified((value) => !value)}
            className={cx(
              "cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors duration-200",
              onlyUnverified
                ? "border-frost bg-frost-soft font-medium text-ink"
                : "border-line text-muted hover:border-frost hover:text-ink",
            )}
          >
            No verified link
          </button>
        </div>
      </Card>

      {merchants.error && <p className="text-sm text-danger">{merchants.error.message}</p>}

      <AdminTable
        head={["Merchant", "Category", "Method", "Cancel link", "Difficulty", ""]}
        empty={!merchants.isPending && (merchants.data?.length ?? 0) === 0}
      >
        {(merchants.data ?? []).flatMap((merchant) => {
          const rows = [
            <tr key={merchant.id}>
              <td className="px-4 py-2.5 font-medium">{merchant.name}</td>
              <td className="px-4 py-2.5 text-muted">{merchant.category}</td>
              <td className="px-4 py-2.5 text-muted">{merchant.cancelMethod}</td>
              <td className="px-4 py-2.5">
                {merchant.cancelUrl === null ? (
                  <span className="text-muted">none</span>
                ) : merchant.cancelUrlVerifiedAt ? (
                  <div className="space-y-0.5">
                    <Badge variant="ok">verified</Badge>
                    <div
                      className="max-w-xs truncate text-xs text-muted"
                      title={merchant.cancelUrl}
                    >
                      {merchant.cancelUrl}
                    </div>
                    {merchant.cancelUrlSource && (
                      <div className="max-w-xs truncate text-xs text-muted">
                        {merchant.cancelUrlSource}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <Badge variant="danger">unverified — hidden</Badge>
                    <div
                      className="max-w-xs truncate text-xs text-muted"
                      title={merchant.cancelUrl}
                    >
                      {merchant.cancelUrl}
                    </div>
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5">
                <DifficultyMeter level={merchant.difficulty} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => setEditing(editing === merchant.id ? null : merchant.id)}
                  className="cursor-pointer text-sm text-frost transition-colors duration-200 hover:text-ink"
                >
                  {editing === merchant.id ? "Close" : "Edit"}
                </button>
              </td>
            </tr>,
          ];
          if (editing === merchant.id) {
            rows.push(
              <EditRow
                key={`${merchant.id}-edit`}
                merchant={merchant as Row}
                onDone={() => setEditing(null)}
              />,
            );
          }
          return rows;
        })}
      </AdminTable>
    </div>
  );
}
