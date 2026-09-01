// The assistant's fallback brain must be able to carry a conversation on
// its own: when Workers AI is unavailable the widget still answers, and
// what it answers must honor the same honesty rules as the landing page.

import { describe, expect, it } from "vitest";
import { ASSISTANT_FACTS, kbAnswer, KB_TOPICS } from "../src/lib/assistant-kb";

describe("assistant knowledge base — fallback answers", () => {
  it("answers the four quick-reply chips with the matching topic", () => {
    expect(kbAnswer("How does it work?")).toContain("read-only");
    expect(kbAnswer("Is my email safe?")).toContain("read-only");
    expect(kbAnswer("What does it cost?")).toContain("$14.99");
    expect(kbAnswer("How does cancelling work?")).toContain("provider confirms");
  });

  it("answers pricing questions with the real D11 prices", () => {
    const answer = kbAnswer("how much do I have to pay?");
    expect(answer).toContain("$14.99");
    expect(answer).toContain("$19/year");
    expect(answer).toMatch(/not a subscription/i);
  });

  it("answers bank questions with the no-bank guarantee wording", () => {
    expect(kbAnswer("do you connect to my bank account?")).toMatch(/no bank connection/i);
  });

  it("answers Hebrew keywords too", () => {
    expect(kbAnswer("כמה זה עולה?")).toContain("$14.99");
    expect(kbAnswer("זה בטוח?")).toContain("read-only");
  });

  it("falls back to a helpful menu, never an empty string", () => {
    const answer = kbAnswer("xyzzy plugh");
    expect(answer.length).toBeGreaterThan(40);
    expect(answer).toContain("support@subzero.o2c.one");
  });

  it("never promises automatic cancellation, in facts or any topic", () => {
    const everything = [ASSISTANT_FACTS, ...KB_TOPICS.map((topic) => topic.answer)].join("\n");
    expect(everything).not.toMatch(/cancels?\s+(them\s+)?(for\s+you|automatically)/i);
    expect(everything).not.toMatch(/auto[-\s]?cancel/i);
  });

  it("carries the price facts the AI grounding prompt needs", () => {
    expect(ASSISTANT_FACTS).toContain("$14.99");
    expect(ASSISTANT_FACTS).toContain("$19 per year");
    expect(ASSISTANT_FACTS).toContain("read-only");
    expect(ASSISTANT_FACTS).toContain("support@subzero.o2c.one");
  });
});
