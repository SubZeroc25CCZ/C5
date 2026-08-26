// Plan resolution + feature gates shared by the tRPC routers (decision D5).

import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Database } from "@/db/client";
import { profiles } from "@/db/schema";
import { asPlan, PLAN_LIMITS, type Plan } from "@/lib/quota";

export async function userPlan(db: Database, userId: string): Promise<Plan> {
  const profile = (
    await db.select({ plan: profiles.plan }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  )[0];
  return asPlan(profile?.plan);
}

/** Throws FORBIDDEN when the plan lacks cancellation features (teaser). */
export function assertCancellationAccess(plan: Plan): void {
  if (!PLAN_LIMITS[plan].cancellation) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cancellation tools are part of Basic — upgrade to prepare and track requests.",
    });
  }
}
