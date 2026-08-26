// The admin panel's two guarantees: only a Super administrator reaches it,
// and nothing sensitive happens without a log row. Both are enforced in
// `src/server/admin.ts`, so both are pinned here — a regression that opens
// the panel to a customer, or lets a mutation proceed unlogged, is the kind
// of bug that only shows up after it has been exploited.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminUserIds, audit, isAdmin } from "../src/server/admin";
import type { Database } from "../src/db/client";

const original = process.env.ADMIN_USER_IDS;

afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_USER_IDS;
  else process.env.ADMIN_USER_IDS = original;
});

describe("admin access", () => {
  it("nobody is an admin when the list is unset — a missing env is not a skeleton key", () => {
    delete process.env.ADMIN_USER_IDS;
    expect(adminUserIds()).toEqual([]);
    expect(isAdmin("user_anyone")).toBe(false);
  });

  it("nobody is an admin when the list is empty or whitespace", () => {
    process.env.ADMIN_USER_IDS = " , ,  ";
    expect(adminUserIds()).toEqual([]);
    expect(isAdmin("user_anyone")).toBe(false);
  });

  it("admits only the listed ids", () => {
    process.env.ADMIN_USER_IDS = "user_founder, user_second";
    expect(isAdmin("user_founder")).toBe(true);
    expect(isAdmin("user_second")).toBe(true);
    expect(isAdmin("user_customer")).toBe(false);
  });

  it("a signed-out visitor is never an admin", () => {
    process.env.ADMIN_USER_IDS = "user_founder";
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin("")).toBe(false);
  });

  it("matches whole ids — a prefix of an admin id is not an admin", () => {
    process.env.ADMIN_USER_IDS = "user_founder";
    expect(isAdmin("user_found")).toBe(false);
    expect(isAdmin("user_founder_evil")).toBe(false);
  });
});

describe("audit log", () => {
  let rows: Array<Record<string, unknown>>;
  let db: Database;

  beforeEach(() => {
    rows = [];
    db = {
      insert: () => ({
        values: async (row: Record<string, unknown>) => {
          rows.push(row);
        },
      }),
    } as unknown as Database;
  });

  it("records the actor, action, target and detail", async () => {
    await audit(db, "user_founder", "merchant.update", {
      target: "merchant:42",
      detail: "cancelUrl none → https://example.com/cancel",
    });
    expect(rows).toEqual([
      {
        actorUserId: "user_founder",
        action: "merchant.update",
        target: "merchant:42",
        detail: "cancelUrl none → https://example.com/cancel",
        ip: null,
      },
    ]);
  });

  it("propagates a failed write — unlike analytics, this one is load-bearing", async () => {
    const exploding = {
      insert: () => ({
        values: async () => {
          throw new Error("database unavailable");
        },
      }),
    } as unknown as Database;
    // Security rule 3 says the log is written BEFORE the action completes.
    // Swallowing the failure here would let the action proceed unrecorded.
    await expect(audit(exploding, "user_founder", "merchant.update")).rejects.toThrow(
      "database unavailable",
    );
  });
});
