import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore, createRateLimiter } from "../src/lib/rate-limit";
import { PLAN_LIMITS, canConnectInbox, hasContinuousSync } from "../src/lib/quota";

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

describe("plan quotas (§8 P0 — free: 1 inbox; Pro: unlimited + continuous sync)", () => {
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
});
