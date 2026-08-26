import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore, createRateLimiter } from "../src/lib/rate-limit";
import {
  PLAN_LIMITS,
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

describe("plan quotas (§8 P0 + decision D2 — free: 1 inbox, monthly re-scan; Pro: unlimited, daily)", () => {
  it("free plan: exactly one connected inbox, no continuous sync", () => {
    expect(PLAN_LIMITS.free.maxConnectedInboxes).toBe(1);
    expect(canConnectInbox("free", 0)).toBe(true);
    expect(canConnectInbox("free", 1)).toBe(false);
    expect(hasContinuousSync("free")).toBe(false);
  });

  it("pro plan: unlimited inboxes and continuous sync", () => {
    expect(canConnectInbox("pro", 25)).toBe(true);
    expect(hasContinuousSync("pro")).toBe(true);
  });

  it("free plan re-scans monthly", () => {
    const now = new Date("2026-08-26T12:00:00Z");
    expect(scanDue("free", null, now)).toBe(true); // never scanned → due
    expect(scanDue("free", new Date("2026-08-01T12:00:00Z"), now)).toBe(false); // 25 days
    expect(scanDue("free", new Date("2026-07-20T12:00:00Z"), now)).toBe(true); // 37 days
    expect(nextScanAt("free", new Date("2026-08-01T12:00:00Z"))).toEqual(
      new Date("2026-08-31T12:00:00Z"),
    );
  });

  it("pro plan re-scans daily", () => {
    const now = new Date("2026-08-26T12:00:00Z");
    expect(scanDue("pro", new Date("2026-08-26T06:00:00Z"), now)).toBe(false); // 6 hours
    expect(scanDue("pro", new Date("2026-08-25T06:00:00Z"), now)).toBe(true); // 30 hours
  });
});
