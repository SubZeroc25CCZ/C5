import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { profiles, users } from "@/db/schema";

/** Upsert the local user + profile rows for a Clerk identity. */
export async function ensureUser(
  db: Database,
  input: { userId: string; email: string; displayName?: string | null },
): Promise<void> {
  const existing = (
    await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1)
  )[0];
  if (!existing) {
    await db.insert(users).values({ id: input.userId, email: input.email });
    await db.insert(profiles).values({
      userId: input.userId,
      displayName: input.displayName ?? null,
    });
  }
}
