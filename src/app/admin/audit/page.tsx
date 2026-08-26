import { AuditClient } from "./audit-client";

export const metadata = { title: "Admin · Audit log" };

export default function AdminAuditPage() {
  return <AuditClient />;
}
