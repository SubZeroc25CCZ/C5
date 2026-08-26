import { describe, expect, it } from "vitest";
import {
  canTransition,
  draftCancellationEmail,
  statusLabel,
} from "../src/services/cancellation-email";

describe("cancellation email drafting (ported v1 service)", () => {
  it("drafts a complete, sendable email", () => {
    const draft = draftCancellationEmail({
      merchantName: "Netflix",
      userName: "Avo",
      accountEmail: "avo@example.com",
      amountFormatted: "€13.99",
      cycle: "monthly",
      lastChargeDate: "2026-08-01",
    });
    expect(draft.subject).toBe("Cancellation request — account avo@example.com");
    expect(draft.body).toContain("cancel my Netflix subscription");
    expect(draft.body).toContain("€13.99 billed monthly");
    expect(draft.body).toContain("Most recent charge: 2026-08-01");
    expect(draft.body).toContain("confirm in writing");
    expect(draft.body.trim().endsWith("Avo")).toBe(true);
  });

  it("omits detail lines it was not given (never fabricates)", () => {
    const draft = draftCancellationEmail({
      merchantName: "Mystery Gym",
      userName: "Avo",
      accountEmail: "avo@example.com",
    });
    expect(draft.body).not.toContain("Plan:");
    expect(draft.body).not.toContain("Most recent charge");
  });
});

describe("status ledger: draft → request_sent → provider_confirmed (§7, §10.2)", () => {
  it("allows only forward transitions", () => {
    expect(canTransition("draft", "request_sent")).toBe(true);
    expect(canTransition("request_sent", "provider_confirmed")).toBe(true);
  });

  it("blocks skipping or reversing", () => {
    expect(canTransition("draft", "provider_confirmed")).toBe(false);
    expect(canTransition("request_sent", "request_sent")).toBe(false);
    expect(canTransition("provider_confirmed", "request_sent")).toBe(false);
    expect(canTransition("provider_confirmed", "draft")).toBe(false);
  });

  it("labels are honest: only provider_confirmed reads as cancelled", () => {
    expect(statusLabel("request_sent")).toContain("awaiting provider confirmation");
    expect(statusLabel("provider_confirmed")).toContain("confirmed by provider");
    expect(statusLabel("draft").toLowerCase()).not.toContain("cancelled");
    expect(statusLabel("request_sent").toLowerCase()).not.toContain("cancelled");
  });
});
