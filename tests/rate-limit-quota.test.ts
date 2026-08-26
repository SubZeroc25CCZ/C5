import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore, createRateLimiter } from "../src/lib/rate-limit";
import {
  PLAN_LIMITS,
  asPlan,
  canConnectInbox,
  hasContinuousSync,
  nextScanAt,
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

describe("plan quotas (§8 P0 + decision D5 — teaser / basic / pro)", () => {
  it("normalizes stored plans: legacy free rows are the teaser tier", () => {
    expect(asPlan("free")).toBe("teaser");
    expect(asPlan(null)).toBe("teaser");
    expect(asPlan("basic")).toBe("basic");
    expect(asPlan("pro")).toBe("pro");
  });

  it("teaser: 1 inbox, redacted results, no re-scan, no cancellation", () => {
    expect(PLAN_LIMITS.teaser.maxConnectedInboxes).toBe(1);
    expect(PLAN_LIMITS.teaser.fullResults).toBe(false);
    expect(PLAN_LIMITS.teaser.cancellation).toBe(false);
    expect(canConnectInbox("teaser", 0)).toBe(true);
    expect(canConnectInbox("teaser", 1)).toBe(false);
    expect(hasContinuousSync("teaser")).toBe(false);
    const now = new Date("2026-08-26T12:00:00Z");
    expect(scanDue("teaser", null, now)).toBe(true); // the initial scan is allowed
    expect(scanDue("teaser", new Date("2020-01-01T00:00:00Z"), now)).toBe(false); // never again
    expect(nextScanAt("teaser", new Date("2026-08-01T12:00:00Z"))).toBeNull();
  });

  it("basic: full results, 1 inbox, 30-day cadence, cancellation, no alerts", () => {
    expect(PLAN_LIMITS.basic.fullResults).toBe(true);
    expect(PLAN_LIMITS.basic.cancellation).toBe(true);
    expect(PLAN_LIMITS.basic.alerts).toBe(false);
    expect(canConnectInbox("basic", 1)).toBe(false);
    const now = new Date("2026-08-26T12:00:00Z");
    expect(scanDue("basic", new Date("2026-08-01T12:00:00Z"), now)).toBe(false); // 25 days
    expect(scanDue("basic", new Date("2026-07-20T12:00:00Z"), now)).toBe(true); // 37 days
    expect(nextScanAt("basic", new Date("2026-08-01T12:00:00Z"))).toEqual(
      new Date("2026-08-31T12:00:00Z"),
    );
  });

  it("pro: unlimited inboxes, daily sync, alerts", () => {
    expect(canConnectInbox("pro", 25)).toBe(true);
    expect(hasContinuousSync("pro")).toBe(true);
    expect(PLAN_LIMITS.pro.alerts).toBe(true);
    const now = new Date("2026-08-26T12:00:00Z");
    expect(scanDue("pro", new Date("2026-08-25T11:00:00Z"), now)).toBe(true);
    expect(scanDue("pro", new Date("2026-08-26T02:00:00Z"), now)).toBe(false);
  });
});
