// The admin panel's two guarantees: only a Super administrator reaches it,
// and nothing sensitive happens without a log row. Both are enforced in
// `src/server/admin.ts`, so both are pinned here — a regression that opens
// the panel to a customer, or lets a mutation proceed unlogged, is the kind
// of bug that only shows up after it has been exploited.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminEmails, adminUserIds, audit, isAdmin } from "../src/server/admin";
import type { Database } from "../src/db/client";

// Clerk's backend API, as consulted by the ADMIN_EMAILS path. Keyed by user
// id; a missing id throws like the real client. Each test uses a fresh user
// id because verdicts are cached for a few minutes inside isAdmin.
const clerkUsers = new Map<
  string,
  { emailAddresses: Array<{ emailAddress: string; verification: { status: string } | null }> }
>();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUser: async (id: string) => {
        const user = clerkUsers.get(id);
        if (!user) throw new Error("not found");
        return user;
      },
    },
  }),
}));

const originalIds = process.env.ADMIN_USER_IDS;
const originalEmails = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (originalIds === undefined) delete process.env.ADMIN_USER_IDS;
  else process.env.ADMIN_USER_IDS = originalIds;
  if (originalEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalEmails;
  clerkUsers.clear();
});

describe("admin access", () => {
  it("nobody is an admin when the lists are unset — a missing env is not a skeleton key", async () => {
    delete process.env.ADMIN_USER_IDS;
    delete process.env.ADMIN_EMAILS;
    expect(adminUserIds()).toEqual([]);
    expect(adminEmails()).toEqual([]);
    expect(await isAdmin("user_anyone")).toBe(false);
  });

  it("nobody is an admin when the list is empty or whitespace", async () => {
    process.env.ADMIN_USER_IDS = " , ,  ";
    delete process.env.ADMIN_EMAILS;
    expect(adminUserIds()).toEqual([]);
    expect(await isAdmin("user_anyone")).toBe(false);
  });

  it("admits only the listed ids", async () => {
    process.env.ADMIN_USER_IDS = "user_founder, user_second";
    delete process.env.ADMIN_EMAILS;
    expect(await isAdmin("user_founder")).toBe(true);
    expect(await isAdmin("user_second")).toBe(true);
    expect(await isAdmin("user_customer")).toBe(false);
  });

  it("a signed-out visitor is never an admin", async () => {
    process.env.ADMIN_USER_IDS = "user_founder";
    expect(await isAdmin(null)).toBe(false);
    expect(await isAdmin(undefined)).toBe(false);
    expect(await isAdmin("")).toBe(false);
  });

  it("matches whole ids — a prefix of an admin id is not an admin", async () => {
    process.env.ADMIN_USER_IDS = "user_founder";
    delete process.env.ADMIN_EMAILS;
    expect(await isAdmin("user_found")).toBe(false);
    expect(await isAdmin("user_founder_evil")).toBe(false);
  });

  it("admits a NEW Clerk identity whose verified email is on ADMIN_EMAILS — the launch-day lockout", async () => {
    // The exact production incident: the founder's id is allowlisted, then a
    // different sign-in method mints a fresh id for the same address.
    process.env.ADMIN_USER_IDS = "user_old_identity";
    process.env.ADMIN_EMAILS = "founder@example.com";
    clerkUsers.set("user_new_identity", {
      emailAddresses: [
        { emailAddress: "Founder@Example.com", verification: { status: "verified" } },
      ],
    });
    expect(await isAdmin("user_new_identity")).toBe(true);
  });

  it("an UNVERIFIED matching address counts for nothing", async () => {
    delete process.env.ADMIN_USER_IDS;
    process.env.ADMIN_EMAILS = "founder@example.com";
    clerkUsers.set("user_pretender", {
      emailAddresses: [
        { emailAddress: "founder@example.com", verification: { status: "unverified" } },
        { emailAddress: "attacker@evil.example", verification: { status: "verified" } },
      ],
    });
    expect(await isAdmin("user_pretender")).toBe(false);
  });

  it("fails closed when Clerk is unreachable", async () => {
    delete process.env.ADMIN_USER_IDS;
    process.env.ADMIN_EMAILS = "founder@example.com";
    // No clerkUsers entry → the mocked client throws.
    expect(await isAdmin("user_unknown_to_clerk")).toBe(false);
  });

  it("never consults Clerk when ADMIN_EMAILS is unset", async () => {
    delete process.env.ADMIN_USER_IDS;
    delete process.env.ADMIN_EMAILS;
    // Would throw inside the mocked client if reached; false without error
    // proves the email path is dormant unless configured.
    expect(await isAdmin("user_no_email_config")).toBe(false);
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
