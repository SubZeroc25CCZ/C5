// Access resolution + feature gates shared by the tRPC routers (D11).

import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Database } from "@/db/client";
import { profiles } from "@/db/schema";
import { ACCESS_LIMITS, resolveAccess, type Access } from "@/lib/quota";
import { PASS } from "@/lib/plans";

export interface AccessState {
  access: Access;
  /** Set while a Cleanup Pass is active (and briefly after it expires). */
  passExpiresAt: Date | null;
}

export async function userAccessState(db: Database, userId: string): Promise<AccessState> {
  const profile = (
    await db
      .select({ plan: profiles.plan, passExpiresAt: profiles.passExpiresAt })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1)
  )[0];
  return {
    access: resolveAccess(profile?.plan, profile?.passExpiresAt ?? null),
    passExpiresAt: profile?.passExpiresAt ?? null,
  };
}

export async function userAccess(db: Database, userId: string): Promise<Access> {
  return (await userAccessState(db, userId)).access;
}

/** Throws FORBIDDEN when the tier lacks cancellation features (free). */
export function assertCancellationAccess(access: Access): void {
  if (!ACCESS_LIMITS[access].cancellation) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Cancellation tools are part of the ${PASS.name} — one payment unlocks them for 30 days.`,
    });
  }
}
