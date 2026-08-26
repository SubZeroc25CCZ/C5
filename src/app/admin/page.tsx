import { HealthClient } from "./health-client";

export const metadata = { title: "Admin · System health" };

export default function AdminHealthPage() {
  return <HealthClient />;
}
