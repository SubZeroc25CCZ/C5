"use client";

// Design-preview harness (development only — the page gates on NODE_ENV).
//
// Renders the REAL <DashboardClient> — same components, tokens, and honesty
// rules as production — against the demo scan in ./fixtures, by swapping the
// tRPC HTTP link for one that answers from those fixtures. This is what the
// landing page's hero screenshot is taken from, and it doubles as a place to
// eyeball dashboard changes without Clerk keys or a database.

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/routers/_app";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import { demoAccounts, demoList } from "./fixtures";

// Queries answer from fixtures; mutations are swallowed (the harness has no
// backend to write to). Anything unlisted fails loudly so a new dashboard
// query can't silently render its error state in a screenshot.
function resolve(path: string): unknown {
  switch (path) {
    case "subscriptions.list":
      return demoList;
    case "review.queue":
      return [];
    case "emailAccounts.list":
      return demoAccounts;
    case "billing.plan":
      return { plan: "pro" };
    case "research.surveyStatus":
      return { answered: true };
    case "research.event":
    case "research.submitSurvey":
      return { ok: true };
    default:
      throw new Error(`No fixture for tRPC path: ${path}`);
  }
}

const fixtureLink: TRPCLink<AppRouter> = () => {
  return ({ op }) =>
    observable((observer) => {
      try {
        observer.next({ result: { type: "data", data: resolve(op.path) } });
        observer.complete();
      } catch (error) {
        observer.error(TRPCClientError.from(error as Error));
      }
    });
};

export function PreviewHarness() {
  const [queryClient] = useState(() => new QueryClient());
  const [client] = useState(() => trpc.createClient({ links: [fixtureLink] }));

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
