import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { track } from "./analytics";

/**
 * Upsert the local user + profile rows for a Clerk identity.
 *
 * `users.email` carries a unique index, so a Clerk id we have never seen
 * arriving with an email we already hold used to throw
 * `UNIQUE constraint failed: users.email` — straight out of the dashboard's
 * server render, as a 500 with a digest and nothing else. That is a real
 * situation, not a corrupt one: the same person can end up with a second
 * Clerk identity (a different sign-in method for the same address, or an
 * identity provider change), and it must never cost them the app.
 *
 * So this is now total: it never throws, whatever collides. What it does
 * NOT do is merge the two accounts — the older identity keeps the
 * subscriptions, inboxes and billing, and deciding who owns what is a
 * product call, not something to improvise inside a page render. The
 * collision is recorded so it is visible rather than silent.
 */
export async function ensureUser(
  db: Database,
  input: { userId: string; email: string; displayName?: string | null },
): Promise<void> {
  const existing = (
    await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1)
  )[0];
  if (existing) return;

  // onConflictDoNothing covers BOTH unique constraints on this table: the id
  // primary key (a concurrent first request) and the email index (the same
  // person under a new Clerk identity).
  await db
    .insert(users)
    .values({ id: input.userId, email: input.email })
    .onConflictDoNothing();

  await db
    .insert(profiles)
    .values({ userId: input.userId, displayName: input.displayName ?? null })
    .onConflictDoNothing();

  // Funnel step 1 (§3.1) — recorded once, when the account first appears.
  await track(db, input.userId, "signed_in");
}
