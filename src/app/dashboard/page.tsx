import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { ensureUser } from "@/services/user";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  // Same graceful-degradation philosophy as the Clerk guard in the root
  // layout: an incomplete environment renders a setup notice, never a 500.
  const dbConfigured = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_D1_DATABASE_ID &&
    process.env.CLOUDFLARE_API_TOKEN
  );
  if (!dbConfigured) {
    return (
      <main>
        <section className="card" style={{ textAlign: "center" }}>
          <h2>Almost there — the database isn&rsquo;t connected yet</h2>
          <p className="muted">
            Add <code>CLOUDFLARE_ACCOUNT_ID</code>, <code>CLOUDFLARE_D1_DATABASE_ID</code> and{" "}
            <code>CLOUDFLARE_API_TOKEN</code> in Vercel (see <code>.env.example</code>), then
            redeploy — environment changes only apply to new deployments.
          </p>
        </section>
      </main>
    );
  }

  await ensureUser(db, {
    userId: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? "",
    displayName: user.fullName,
  });

  return <DashboardClient />;
}
