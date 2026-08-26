import { describe, expect, it } from "vitest";
import { runStage2 } from "../src/ingestion/stage2-extractor";
import { AUTO_ACCEPT_CONFIDENCE } from "../src/engine/extraction";

const input = { from: "x@unknown.example", subject: "Receipt", body: "..." };

describe("stage 2 gate (§5.2 — below-threshold goes to review, never silently saved)", () => {
  it("accepts a confident extraction", async () => {
    const outcome = await runStage2(
      {
        complete: async () =>
          '{"merchant":"Mystery Gym","amount":29.9,"currency":"EUR","chargedAt":"2026-08-02","cycleHint":"monthly","confidence":0.92}',
      },
      input,
    );
    expect(outcome.charge?.merchant).toBe("Mystery Gym");
    expect(outcome.needsReview).toBe(false);
  });

  it("routes low-confidence extractions to the review queue", async () => {
    const outcome = await runStage2(
      {
        complete: async () =>
          '{"merchant":"Mystery Gym","amount":29.9,"currency":"EUR","chargedAt":"2026-08-02","cycleHint":"monthly","confidence":0.5}',
      },
      input,
    );
    expect(outcome.charge).not.toBeNull();
    expect(outcome.needsReview).toBe(true);
    expect(0.5).toBeLessThan(AUTO_ACCEPT_CONFIDENCE);
  });

  it("drops non-billing emails and malformed replies", async () => {
    expect((await runStage2({ complete: async () => "null" }, input)).charge).toBeNull();
    expect(
      (await runStage2({ complete: async () => "I could not parse this email" }, input)).charge,
    ).toBeNull();
  });
});
