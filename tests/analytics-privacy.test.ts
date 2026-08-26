// Research kit §3 privacy rule: analytics events carry a pseudonymous user
// id, an event name, and at most one small number — never a merchant name,
// an amount, an email address, or any free text. These tests pin that shape
// so a future "just add the merchant to the event" never lands quietly.

import { describe, expect, it, vi } from "vitest";
import { track } from "../src/services/analytics";
import type { Database } from "../src/db/client";

function recordingDb() {
  const rows: Array<Record<string, unknown>> = [];
  const db = {
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        rows.push(row);
      },
    }),
  } as unknown as Database;
  return { db, rows };
}

describe("analytics privacy", () => {
  it("records only userId, name, and an optional number", async () => {
    const { db, rows } = recordingDb();
    await track(db, "user_abc", "cancellation_confirmed", 3);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual(["name", "userId", "value"]);
    expect(rows[0]).toEqual({ userId: "user_abc", name: "cancellation_confirmed", value: 3 });
  });

  it("nulls the value when none is given — never an object or string", async () => {
    const { db, rows } = recordingDb();
    await track(db, "user_abc", "scan_started");
    expect(rows[0]!.value).toBeNull();
    for (const value of Object.values(rows[0]!)) {
      expect(["string", "number", "object"]).toContain(typeof value);
      if (typeof value === "object") expect(value).toBeNull();
    }
  });

  it("never throws — instrumentation must not break a user's request", async () => {
    const exploding = {
      insert: () => ({
        values: async () => {
          throw new Error("database on fire");
        },
      }),
    } as unknown as Database;
    await expect(track(exploding, "user_abc", "scan_completed", 25)).resolves.toBeUndefined();
  });

  it("event names are a closed vocabulary — no free-form strings", async () => {
    const { db } = recordingDb();
    // @ts-expect-error the union rejects anything not on the list
    await track(db, "user_abc", `merchant:Netflix charged 12.99`);
    vi.restoreAllMocks();
  });
});
