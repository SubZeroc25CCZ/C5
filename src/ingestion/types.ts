/**
 * A raw email candidate as fetched from the provider. The `body` field only
 * ever lives in worker memory — nothing downstream of the pipeline is allowed
 * to persist or log it (§6), which `tests/pipeline-privacy.test.ts` enforces.
 */
export interface EmailCandidate {
  messageId: string;
  from: string; // full From header, e.g. `Netflix <info@account.netflix.com>`
  subject: string;
  receivedAt: Date;
  body: string;
}

/**
 * The only shape the pipeline is allowed to persist for a charge (§6):
 * merchant, amount, currency, date, cycle hint, message-id reference,
 * subject (for the "what we saw" log). Never the body.
 */
export interface PersistableCharge {
  messageId: string;
  merchantName: string;
  merchantId: number | null;
  amountMinor: number;
  currency: string;
  chargedAt: Date;
  sourceSubject: string;
  cycleHint: "weekly" | "monthly" | "quarterly" | "yearly" | "unknown";
  /** 0–100; null for deterministic Stage 1 extractions. */
  confidence: number | null;
  needsReview: boolean;
}

export interface MerchantRecord {
  id: number;
  name: string;
  slug: string;
  domains: string[];
  category: string;
  cancelUrl: string | null;
  cancelMethod: "url" | "email" | "phone" | "unknown";
  cancelEmail?: string | null;
  difficulty: number;
}
