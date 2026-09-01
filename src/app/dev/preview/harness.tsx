"use client";

// Design-preview harness (development only — the page gates on NODE_ENV).
//
// Renders the REAL <DashboardClient> — same components, tokens, and honesty
// rules as production — against the demo scan in ./fixtures, by swapping the
// tRPC HTTP link for one that answers from those fixtures. This is what the
// landing page's hero screenshot is taken from, and it doubles as a place to
// eyeball dashboard changes without Clerk keys or a database.
//
// The `state` prop selects which of the dashboard's states renders, so the
// non-happy paths (design law 4) can be reviewed and screenshot without
// manufacturing real failures.

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/routers/_app";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import { SubscriptionDetailClient } from "@/app/dashboard/subscriptions/[id]/detail-client";
import { demoAccounts, demoDetail, demoList, emptyList } from "./fixtures";

export type PreviewState = "default" | "empty" | "noinbox" | "loading" | "error";

// Queries answer from fixtures; mutations are swallowed (the harness has no
// backend to write to). Anything unlisted fails loudly so a new dashboard
// query can't silently render its error state in a screenshot.
function resolve(path: string, state: PreviewState): unknown {
  switch (path) {
    case "subscriptions.list":
      return state === "default" ? demoList : emptyList;
    case "subscriptions.get":
      return demoDetail();
    case "review.queue":
      return [];
    case "emailAccounts.list":
      return state === "noinbox" ? [] : demoAccounts;
    case "billing.plan":
      return { access: "pass", passExpiresAt: new Date(Date.now() + 21 * 86_400_000) };
    case "research.surveyStatus":
      return { answered: true };
    case "research.event":
    case "research.submitSurvey":
      return { ok: true };
    default:
      throw new Error(`No fixture for tRPC path: ${path}`);
  }
}

function fixtureLink(state: PreviewState): TRPCLink<AppRouter> {
  return () =>
    ({ op }) =>
      observable((observer) => {
        // "loading" never resolves the list; "error" rejects it. Every other
        // query keeps answering so the rest of the page stays real.
        if (op.path === "subscriptions.list") {
          if (state === "loading") return;
          if (state === "error") {
            observer.error(new TRPCClientError("Fixture: fetch failed"));
            return;
          }
        }
        try {
          observer.next({ result: { type: "data", data: resolve(op.path, state) } });
          observer.complete();
        } catch (error) {
          observer.error(TRPCClientError.from(error as Error));
        }
      });
}

/** /dev/preview/subscription — the detail page against the demo scan. */
export function PreviewDetailHarness() {
  const [queryClient] = useState(() => new QueryClient());
  const [client] = useState(() => trpc.createClient({ links: [fixtureLink("default")] }));
  const id = demoDetail().subscription.id;
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <div data-preview-root>
          <SubscriptionDetailClient id={id} />
        </div>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export function PreviewHarness({ state }: { state: PreviewState }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // The error state should render the error, not retry forever.
        defaultOptions: { queries: { retry: false } },
      }),
  );
  const [client] = useState(() => trpc.createClient({ links: [fixtureLink(state)] }));

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <div data-preview-root>
          <DashboardClient />
        </div>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
