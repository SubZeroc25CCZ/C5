import { describe, expect, it } from "vitest";
import {
  BACKFILL_MONTHS,
  MAX_MESSAGES_PER_SCAN,
  buildBackfillQueries,
  buildDeltaQueries,
} from "../src/ingestion/gmail-queries";

describe("gmail query strategy (§5.1 — search, don't read)", () => {
  const now = new Date("2026-08-26T12:00:00Z");
  const domains = ["netflix.com", "spotify.com", "adobe.com"];

  it("targets the last 24 months", () => {
    expect(BACKFILL_MONTHS).toBe(24);
    const queries = buildBackfillQueries(domains, now);
    for (const query of queries) {
      expect(query).toContain("after:2024/08/26");
    }
  });

  it("includes all four spec query families", () => {
    const joined = buildBackfillQueries(domains, now).join("\n");
    expect(joined).toContain("subject:(receipt OR invoice");
    expect(joined).toContain('"has been charged"');
    expect(joined).toContain("category:purchases");
    expect(joined).toContain("from:(netflix.com OR spotify.com OR adobe.com)");
  });

  it("chunks large domain lists to keep queries valid", () => {
    const many = Array.from({ length: 60 }, (_, i) => `merchant${i}.com`);
    const fromQueries = buildBackfillQueries(many, now).filter((query) => query.includes("from:("));
    expect(fromQueries.length).toBe(3); // 60 domains / 25 per chunk
  });

  it("delta queries window by days since last sync", () => {
    const queries = buildDeltaQueries(domains, 2.4, now);
    for (const query of queries) {
      expect(query).toContain("newer_than:3d");
    }
  });

  it("caps messages per scan in the 200–500 target band", () => {
    expect(MAX_MESSAGES_PER_SCAN).toBeLessThanOrEqual(500);
    expect(MAX_MESSAGES_PER_SCAN).toBeGreaterThanOrEqual(200);
  });
});
