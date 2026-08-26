import { notFound } from "next/navigation";
import { PreviewHarness } from "./harness";

// Development-only: the design-preview harness never ships. In production
// builds this route is a 404 before any fixture code runs.
export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PreviewHarness />;
}
