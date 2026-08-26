import { notFound } from "next/navigation";
import { PreviewHarness, type PreviewState } from "./harness";

// Development-only: the design-preview harness never ships. In production
// builds this route is a 404 before any fixture code runs.
//
// ?state= renders the dashboard's non-happy paths for review and
// screenshots: default | empty (scanned, nothing found) | noinbox (first
// visit) | loading (skeletons) | error (failed fetch + retry).
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { state } = await searchParams;
  const valid: PreviewState[] = ["default", "empty", "noinbox", "loading", "error"];
  const chosen = valid.includes(state as PreviewState) ? (state as PreviewState) : "default";
  return <PreviewHarness state={chosen} />;
}
