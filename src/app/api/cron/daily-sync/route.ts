import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailAccounts, profiles } from "@/db/schema";
import { hasContinuousSync } from "@/lib/quota";
import { runScan } from "@/services/scan";

// Daily delta sync (§5.4), Vercel cron. Continuous sync is Pro-only (§8 P0).

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await db
    .select({ account: emailAccounts, plan: profiles.plan })
    .from(emailAccounts)
    .innerJoin(profiles, eq(profiles.userId, emailAccounts.userId))
    .where(and(eq(emailAccounts.status, "active"), eq(emailAccounts.provider, "gmail")));

  const results: Array<{ accountId: number; ok: boolean; error?: string }> = [];
  for (const { account, plan } of accounts) {
    if (!hasContinuousSync(plan)) continue;
    try {
      await runScan(db, {
        userId: account.userId,
        emailAccountId: account.id,
        mode: "delta",
      });
      results.push({ accountId: account.id, ok: true });
    } catch (error) {
      results.push({
        accountId: account.id,
        ok: false,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return NextResponse.json({ synced: results });
}
