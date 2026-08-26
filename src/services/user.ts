import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { track } from "./analytics";

/**
 * Upsert the local user + profile rows for a Clerk identity.
 *
 * This used to throw `UNIQUE constraint failed: users.email` — a 500 on
 * /dashboard during server render — whenever a Clerk id we had never seen
 * arrived with an email we already held.
 *
 * The real fault was the schema, not this function. `users` mirrors Clerk
 * identities, and Clerk does not promise one identity per address: the same
 * person can hold a second through a different sign-in method or a provider
 * change. The unique index asserted an invariant the upstream system never
 * guaranteed, so the index is gone (drizzle/0004) and the Clerk id — the
 * only identity that actually decides anything — remains the primary key.
 *
 * onConflictDoNothing stays for the case it is genuinely for: two concurrent
 * first requests from the same new user racing on the id primary key.
 *
 * Note this creates a SEPARATE local account per Clerk identity; it does not
 * merge them. For the two orphaned identities this bug produced that costs
 * nothing — they held no subscriptions, inboxes or billing, only landing
 * page events. Merging accounts, if it is ever needed, is a migration and a
 * product decision, not something to improvise inside a page render.
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
