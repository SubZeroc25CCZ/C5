import { notFound } from "next/navigation";
import { PreviewDetailHarness } from "../harness";

// Development-only: the subscription-detail page against the demo scan.
export default function PreviewSubscriptionPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PreviewDetailHarness />;
}
