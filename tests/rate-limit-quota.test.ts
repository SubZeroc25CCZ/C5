import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore, createRateLimiter } from "../src/lib/rate-limit";
import {
  ACCESS_LIMITS,
  canConnectInbox,
  hasContinuousSync,
  nextScanAt,
  resolveAccess,
  scanDue,
} from "../src/lib/quota";

describe("rate limiting (§8 P0 — AI-touching endpoints)", () => {
  it("allows up to the limit, then blocks within the window", async () => {
    const check = createRateLimiter({ limit: 3, windowMs: 60_000, store: new MemoryRateLimitStore() });
    const t0 = 1_000_000;
    expect((await check("user-1", t0)).allowed).toBe(true);
    expect((await check("user-1", t0 + 1)).allowed).toBe(true);
    expect((await check("user-1", t0 + 2)).allowed).toBe(true);
    expect((await check("user-1", t0 + 3)).allowed).toBe(false);
  });

  it("resets after the window elapses", async () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1_000, store: new MemoryRateLimitStore() });
    const t0 = 5_000;
    expect((await check("user-1", t0)).allowed).toBe(true);
    expect((await check("user-1", t0 + 500)).allowed).toBe(false);
    expect((await check("user-1", t0 + 1_001)).allowed).toBe(true);
  });

  it("tracks keys independently", async () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000, store: new MemoryRateLimitStore() });
    expect((await check("user-1", 0)).allowed).toBe(true);
    expect((await check("user-2", 1)).allowed).toBe(true);
    expect((await check("user-1", 2)).allowed).toBe(false);
  });
});

describe("access resolution (D11 — free / pass / guardian)", () => {
  const now = new Date("2026-09-01T12:00:00Z");

  it("no billing state means free — including every legacy free/teaser row", () => {
    expect(resolveAccess(null, null, now)).toBe("free");
    expect(resolveAccess("free", null, now)).toBe("free");
    expect(resolveAccess("teaser", null, now)).toBe("free");
    expect(resolveAccess(undefined, undefined, now)).toBe("free");
  });

  it("a live Pass grants pass access; guardian outranks it", () => {
    const future = new Date(now.getTime() + 86_400_000);
    expect(resolveAccess("free", future, now)).toBe("pass");
    expect(resolveAccess("guardian", future, now)).toBe("guardian");
  });

  it("the Pass boundary is strict: expired means expired, to the millisecond", () => {
    // We sold "30 days" — the product's honesty rules apply to its own billing.
    expect(resolveAccess("free", new Date(now.getTime() + 1), now)).toBe("pass");
    expect(resolveAccess("free", new Date(now.getTime()), now)).toBe("free");
    expect(resolveAccess("free", new Date(now.getTime() - 1), now)).toBe("free");
  });

  it("legacy basic/pro rows are grandfathered to guardian-level access", () => {
    expect(resolveAccess("basic", null, now)).toBe("guardian");
    expect(resolveAccess("pro", null, now)).toBe("guardian");
  });

  it("free: 1 inbox, redacted results, no re-scan, no cancellation", () => {
    expect(ACCESS_LIMITS.free.maxConnectedInboxes).toBe(1);
    expect(ACCESS_LIMITS.free.fullResults).toBe(false);
    expect(ACCESS_LIMITS.free.cancellation).toBe(false);
    expect(canConnectInbox("free", 0)).toBe(true);
    expect(canConnectInbox("free", 1)).toBe(false);
    expect(hasContinuousSync("free")).toBe(false);
    expect(scanDue("free", null, now)).toBe(true); // the initial scan is allowed
    expect(scanDue("free", new Date("2020-01-01T00:00:00Z"), now)).toBe(false); // never again
    expect(nextScanAt("free", new Date("2026-08-01T12:00:00Z"))).toBeNull();
  });

  it("pass: full access, 3 inboxes, daily re-scan, cancellation + alerts", () => {
    expect(ACCESS_LIMITS.pass.fullResults).toBe(true);
    expect(ACCESS_LIMITS.pass.cancellation).toBe(true);
    expect(ACCESS_LIMITS.pass.alerts).toBe(true);
    expect(canConnectInbox("pass", 2)).toBe(true);
    expect(canConnectInbox("pass", 3)).toBe(false);
    expect(hasContinuousSync("pass")).toBe(true);
    expect(scanDue("pass", new Date("2026-08-31T11:00:00Z"), now)).toBe(true);
    expect(scanDue("pass", new Date("2026-09-01T02:00:00Z"), now)).toBe(false);
  });

  it("guardian: full access, monthly cadence, alerts", () => {
    expect(ACCESS_LIMITS.guardian.fullResults).toBe(true);
    expect(ACCESS_LIMITS.guardian.alerts).toBe(true);
    expect(scanDue("guardian", new Date("2026-08-07T12:00:00Z"), now)).toBe(false); // 25 days
    expect(scanDue("guardian", new Date("2026-07-26T12:00:00Z"), now)).toBe(true); // 37 days
    expect(nextScanAt("guardian", new Date("2026-08-07T12:00:00Z"))).toEqual(
      new Date("2026-09-06T12:00:00Z"),
    );
  });
});
