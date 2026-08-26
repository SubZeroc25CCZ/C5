// A production 500 on /dashboard, digest 430401609:
//   UNIQUE constraint failed: users.email
//
// ensureUser looked the account up by Clerk id, found nothing, and inserted —
// but users.email is unique, so a NEW Clerk identity carrying an email we
// already held took the whole dashboard down on server render. These tests
// hold the guarantee that came out of it: ensureUser is total. Whatever
// collides, the page still renders.

import { describe, expect, it } from "vitest";
import { ensureUser } from "../src/services/user";
import type { Database } from "../src/db/client";

/** A database whose inserts reject unless the conflict is swallowed. */
function db(options: {
  knownIds?: string[];
  /** Constraints that fire unless .onConflictDoNothing() was chained. */
  failingInserts?: boolean;
}): { db: Database; inserted: string[] } {
  const inserted: string[] = [];
  const conflict = () =>
    Object.assign(new Error("D1 query failed: UNIQUE constraint failed: users.email"), {
      name: "Error",
    });

  const database = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () =>
            (options.knownIds ?? []).length > 0 ? [{ id: options.knownIds![0] }] : [],
        }),
      }),
    }),
    insert: () => {
      const builder = {
        values(row: Record<string, unknown>) {
          const record = {
            // Without onConflictDoNothing the constraint is fatal, exactly as
            // it was in production.
            then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
              if (options.failingInserts) reject(conflict());
              else {
                inserted.push(String(row.id ?? row.userId));
                resolve(undefined);
              }
            },
            onConflictDoNothing() {
              // The conflict is absorbed: nothing inserted, nothing thrown.
              if (!options.failingInserts) inserted.push(String(row.id ?? row.userId));
              return Promise.resolve(undefined);
            },
          };
          return record;
        },
      };
      return builder;
    },
  } as unknown as Database;

  return { db: database, inserted };
}

describe("ensureUser", () => {
  it("does nothing for a Clerk id it already knows", async () => {
    const { db: database, inserted } = db({ knownIds: ["user_known"] });
    await ensureUser(database, { userId: "user_known", email: "a@o2c.one" });
    expect(inserted).toEqual([]);
  });

  it("creates the user and profile for a genuinely new identity", async () => {
    const { db: database, inserted } = db({});
    await ensureUser(database, { userId: "user_new", email: "new@example.com" });
    // Three writes, all keyed to the new id: the user row, the profile row,
    // and the signed_in funnel event that track() records for a first sight.
    expect(inserted).toEqual(["user_new", "user_new", "user_new"]);
  });

  it("survives a new Clerk id arriving with an email we already hold", async () => {
    // The production case. Before the fix this rejected and the dashboard
    // rendered a 500 instead of the app.
    const { db: database } = db({ failingInserts: true });
    await expect(
      ensureUser(database, { userId: "user_second_identity", email: "asafohana@gmail.com" }),
    ).resolves.toBeUndefined();
  });

  it("still resolves when every write conflicts", async () => {
    const { db: database } = db({ failingInserts: true });
    await expect(
      ensureUser(database, { userId: "user_x", email: "x@example.com", displayName: "X" }),
    ).resolves.toBeUndefined();
  });
});
