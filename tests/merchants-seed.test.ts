// §8 P0: "Merchant DB with ≥300 seeded merchants incl. cancel playbooks."

import { describe, expect, it } from "vitest";
import { loadSeedMerchants, seedAsRecords, slugify } from "../src/merchants/seed";

describe("merchant seed", () => {
  const merchants = loadSeedMerchants();

  it("has at least 300 merchants", () => {
    expect(merchants.length).toBeGreaterThanOrEqual(300);
  });

  it("every merchant has a complete cancel playbook skeleton", () => {
    for (const merchant of merchants) {
      expect(merchant.name.length).toBeGreaterThan(0);
      expect(merchant.domains.length).toBeGreaterThan(0);
      expect(merchant.category.length).toBeGreaterThan(0);
      expect(["url", "email", "phone", "unknown"]).toContain(merchant.cancel_method);
      expect(merchant.difficulty).toBeGreaterThanOrEqual(1);
      expect(merchant.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it("ships only verified cancel URLs: https, on the merchant's own domain", () => {
    // The editorial rule: cancel_url stays null until verified during build.
    // Verified entries must be official pages — https and hosted on one of
    // the merchant's OWN seed domains, so a bad edit can't point users at a
    // third-party site.
    for (const merchant of merchants) {
      if (merchant.cancel_url === null) continue;
      const url = new URL(merchant.cancel_url);
      expect(url.protocol, merchant.name).toBe("https:");
      const onOwnDomain = merchant.domains.some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      );
      expect(onOwnDomain, `${merchant.name}: ${url.hostname}`).toBe(true);
      // A verified URL implies the URL cancellation method.
      expect(merchant.cancel_method, merchant.name).toBe("url");
    }
  });

  it("has verified escape paths for the biggest consumer merchants", () => {
    const byName = new Map(merchants.map((merchant) => [merchant.name, merchant]));
    for (const name of ["Netflix", "Spotify", "Disney+", "Amazon Prime", "YouTube Premium"]) {
      expect(byName.get(name)?.cancel_url, name).toBeTruthy();
    }
  });

  it("has unique names and unique slugs", () => {
    const names = merchants.map((merchant) => merchant.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const slugs = seedAsRecords().map((record) => record.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers the priority international markets (EU/UK/IL/TH/PH)", () => {
    const names = new Set(merchants.map((merchant) => merchant.name));
    expect(names.has("Deliveroo Plus")).toBe(true); // UK/EU
    expect(names.has("yes")).toBe(true); // IL
    expect(names.has("TrueID")).toBe(true); // TH
    expect(names.has("iWantTFC")).toBe(true); // PH
  });

  it("slugifies names deterministically", () => {
    expect(slugify("Disney+")).toBe("disney");
    expect(slugify("ChatGPT / OpenAI")).toBe("chatgpt-openai");
    expect(slugify("Sam's Club")).toBe("sam-s-club");
  });
});
