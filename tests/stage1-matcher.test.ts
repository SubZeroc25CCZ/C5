import { describe, expect, it } from "vitest";
import { MerchantMatcher, senderDomain } from "../src/ingestion/stage1-matcher";
import { seedAsRecords } from "../src/merchants/seed";

describe("senderDomain", () => {
  it("extracts the domain from display-name headers", () => {
    expect(senderDomain("Netflix <info@account.netflix.com>")).toBe("account.netflix.com");
    expect(senderDomain("billing@spotify.com")).toBe("spotify.com");
    expect(senderDomain('"Weird, Name" <x@Y.Example.COM>')).toBe("y.example.com");
  });

  it("returns null for garbage", () => {
    expect(senderDomain("not an email")).toBeNull();
    expect(senderDomain("")).toBeNull();
  });
});

describe("MerchantMatcher against the real seed", () => {
  const matcher = new MerchantMatcher(seedAsRecords());

  it("matches exact domains", () => {
    expect(matcher.match("Netflix <info@netflix.com>")?.name).toBe("Netflix");
    expect(matcher.match("Spotify <no-reply@spotify.com>")?.name).toBe("Spotify");
  });

  it("matches subdomains of known billing domains", () => {
    expect(matcher.match("Netflix <info@account.netflix.com>")?.name).toBe("Netflix");
    expect(matcher.match("<receipts@mailer.billing.dropbox.com>")?.name).toBe("Dropbox");
  });

  it("refuses ambiguous conglomerate domains (Stage 2's job)", () => {
    // google.com serves both Google One and YouTube Premium in the seed.
    expect(matcher.match("Google <payments-noreply@google.com>")).toBeNull();
    expect(matcher.match("Apple <no_reply@apple.com>")).toBeNull();
  });

  it("does not match unknown senders", () => {
    expect(matcher.match("Random <x@random-shop.example>")).toBeNull();
  });

  it("never mistakes a lookalike domain for a merchant", () => {
    expect(matcher.match("Phish <billing@netflix.com.evil.example>")).toBeNull();
    expect(matcher.match("Phish <billing@fakenetflix.com>")).toBeNull();
  });

  it("exposes known domains for the from: query set", () => {
    expect(matcher.knownDomains()).toContain("netflix.com");
    expect(matcher.knownDomains().length).toBeGreaterThan(300);
  });
});
