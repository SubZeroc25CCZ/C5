// The landing assistant's knowledge base. Two consumers:
//
//   1. The AI path builds its system prompt from FACTS — the model may
//      rephrase but must not invent beyond them.
//   2. The fallback path (AI unavailable, over quota, or misconfigured)
//      answers directly from TOPICS by keyword match, so the widget is
//      never a dead button — the exact failure the landing facelift exists
//      to remove.
//
// Every sentence here is visitor-facing copy and is held to the landing
// honesty rules (tests/landing-copy.test.ts scans this file): no savings
// claims, no automatic-cancellation promises, no privacy overclaims.
// Prices come from @/lib/plans — the single source of truth — so a future
// price change cannot leave the bot quoting the old number.

import { GUARDIAN, PASS } from "@/lib/plans";

export const ASSISTANT_FACTS = `
SubZero (subzero.o2c.one) finds recurring subscriptions in email receipts.
- Access is read-only: SubZero cannot send, delete, or modify email. The permission itself forbids it.
- No bank connection ever: no card details, no banking credentials. Only email receipts.
- Message bodies are processed in memory and discarded; SubZero keeps extracted facts (merchant, amount, date) plus a reference to the original receipt.
- Access can be revoked anytime from Settings or directly from the user's Google account.
- The free scan covers up to 24 months of receipts and shows per-currency totals, how many subscriptions were found, and the most expensive one in full detail with evidence. The rest stay locked until purchase.
- Cleanup Pass: ${PASS.price}, one payment, NOT a subscription, never renews. 30 days of full access: every subscription unlocked with evidence and price history, all cancellation tools, daily re-scans to confirm charges stopped.
- Guardian: ${GUARDIAN.price} per year (annual only). After the cleanup it keeps watch: monthly automatic re-scan, price-increase alerts, new-subscription detection, up to 3 connected inboxes.
- Cancellation: SubZero prepares the clearest available path (direct link, phone number, or a prepared email the user sends). SubZero itself never performs the cancellation; a subscription counts as cancelled only when the provider confirms.
- Gmail is supported today. Payments are handled by Stripe.
- Support: support@subzero.o2c.one.
`.trim();

export interface KbTopic {
  id: string;
  keywords: string[];
  answer: string;
}

export const KB_TOPICS: KbTopic[] = [
  {
    id: "how",
    // "work"/"works" alone are too greedy — "how does cancelling work?"
    // must land on the cancel topic, so this one only owns the full phrase.
    keywords: ["how it works", "how does it work", "scan", "start", "detect", "איך זה עובד", "סריקה"],
    answer:
      "Connect Gmail with read-only access and SubZero scans up to 24 months of receipts — about two minutes. You get every recurring charge grouped by merchant, with the receipts behind each one as evidence. The scan is free: it shows your totals and your most expensive subscription in full.",
  },
  {
    id: "privacy",
    keywords: [
      "safe", "safety", "privacy", "private", "secure", "security", "trust", "read", "email",
      "data", "store", "storing", "delete", "בטוח", "פרטיות", "מאובטח",
    ],
    answer:
      "Access is read-only — SubZero cannot send, delete, or modify anything; the permission itself forbids it. Message bodies are processed in memory and discarded; we keep only the extracted facts (merchant, amount, date) plus a reference to the receipt. You can revoke access anytime, from Settings or from your Google account directly.",
  },
  {
    id: "pricing",
    keywords: [
      "price", "pricing", "cost", "pay", "much", "fee", "pass", "guardian", "subscription",
      "cheap", "free", "מחיר", "עולה", "כמה", "תשלום",
    ],
    answer:
      `The scan is free — it shows your totals and your most expensive subscription with evidence. One ${PASS.price} payment (the Cleanup Pass — not a subscription, it never renews) unlocks everything for 30 days: the full list plus all cancellation tools. Guardian is optional at ${GUARDIAN.price}/year and keeps re-scanning after the cleanup.`,
  },
  {
    id: "cancel",
    keywords: ["cancel", "cancellation", "stop", "unsubscribe", "quit", "end", "ביטול", "לבטל"],
    answer:
      "For each subscription SubZero gives you the clearest available way out: a direct cancellation link, a phone number, or a prepared email you send yourself. We don't pretend to cancel things behind your back — a subscription is marked cancelled only when the provider confirms it, and the daily re-scans check the charges actually stopped.",
  },
  {
    id: "bank",
    keywords: ["bank", "card", "credit", "account", "connect bank", "banking", "בנק", "אשראי", "כרטיס"],
    answer:
      "No bank connection, ever. SubZero works entirely from email receipts — we ask for no card details and no banking credentials. Checkout for the Cleanup Pass is handled by Stripe, so we never see your card either.",
  },
  {
    id: "providers",
    keywords: ["gmail", "google", "outlook", "yahoo", "provider", "inbox", "mail"],
    answer:
      "Gmail is supported today, with read-only access. If you're on another provider, email support@subzero.o2c.one and tell us which one — it directly shapes what we build next.",
  },
];

const DEFAULT_ANSWER = `I can help with how SubZero works, what the free scan shows, privacy and read-only access, pricing (${PASS.price} one-time Cleanup Pass, optional ${GUARDIAN.price}/year Guardian), and how cancellation works. For anything else, a human reads every mail to support@subzero.o2c.one.`;

/** Keyword-scored fallback answer. Deterministic and dependency-free. */
export function kbAnswer(message: string): string {
  const text = message.toLowerCase();
  let best: { topic: KbTopic; score: number } | null = null;
  for (const topic of KB_TOPICS) {
    let score = 0;
    for (const keyword of topic.keywords) {
      if (text.includes(keyword)) score += keyword.length > 3 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  return best ? best.topic.answer : DEFAULT_ANSWER;
}
