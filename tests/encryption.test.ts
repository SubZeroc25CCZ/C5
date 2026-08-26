import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../src/lib/encryption";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("per-user token encryption (§6)", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a refresh token", () => {
    const token = "1//0refresh-token-value";
    const stored = encryptToken("user_abc", token);
    expect(stored).not.toContain(token);
    expect(decryptToken("user_abc", stored)).toBe(token);
  });

  it("uses a distinct key per user — one user's ciphertext is useless to another", () => {
    const stored = encryptToken("user_abc", "secret");
    expect(() => decryptToken("user_other", stored)).toThrow();
  });

  it("produces distinct ciphertexts for the same plaintext (random IV)", () => {
    expect(encryptToken("user_abc", "secret")).not.toBe(encryptToken("user_abc", "secret"));
  });

  it("rejects a missing or malformed master key", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("user_abc", "secret")).toThrow(/TOKEN_ENCRYPTION_KEY/);
    process.env.TOKEN_ENCRYPTION_KEY = "too-short";
    expect(() => encryptToken("user_abc", "secret")).toThrow(/32 bytes/);
  });
});
