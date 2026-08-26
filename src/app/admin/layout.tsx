import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { isAdmin, auditSession } from "@/server/admin";

// The panel is gated twice on purpose: here, so a non-admin never receives
// the HTML, and again on every tRPC procedure (`adminProcedure`), so a
// hand-rolled request to the API is refused even if this page were bypassed.
// A signed-in customer who guesses the URL gets a 404, not a 403 — the panel
// does not confirm its own existence.

const TABS = [
  { href: "/admin", label: "Health" },
  { href: "/admin/scans", label: "Scans" },
  { href: "/admin/extractions", label: "Extractions" },
  { href: "/admin/merchants", label: "Merchants" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();

  // Security rule 3: an admin sign-in is itself an audited event. A failure
  // to record it is a failure to enter — the log is not best-effort.
  await auditSession(db, userId!);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-bold">Admin</h1>
          <span className="text-xs text-muted">
            Super administrator · every action below is logged
          </span>
        </div>
        <nav className="mt-4 flex flex-wrap gap-1 border-b border-line">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-t-lg px-3 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
