import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailAccounts, profiles } from "@/db/schema";
import { resolveAccess, scanDue } from "@/lib/quota";
import { runScan } from "@/services/scan";

// Daily cron (§5.4): re-scans every account due under its tier's cadence —
// Cleanup Pass daily while active, Guardian monthly (D11).

export async function GET(req: Request) {
  // Fail closed: with no CRON_SECRET configured, no header can authorize —
  // otherwise a literal "Bearer undefined" would match the template string.
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await db
    .select({ account: emailAccounts, plan: profiles.plan, passExpiresAt: profiles.passExpiresAt })
    .from(emailAccounts)
    .innerJoin(profiles, eq(profiles.userId, emailAccounts.userId))
    .where(and(eq(emailAccounts.status, "active"), eq(emailAccounts.provider, "gmail")));

  const results: Array<{ accountId: number; ok: boolean; error?: string }> = [];
  for (const { account, plan, passExpiresAt } of accounts) {
    if (!scanDue(resolveAccess(plan, passExpiresAt), account.lastSyncedAt)) continue;
    try {
      await runScan(db, {
        userId: account.userId,
        emailAccountId: account.id,
        mode: "delta",
        trigger: "cron",
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
