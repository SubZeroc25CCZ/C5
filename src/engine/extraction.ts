/**
 * SubZero v2 — Stage 2 AI extraction contract.
 * Only emails NOT matched by the merchant database (Stage 1) reach this stage.
 * The model must return this exact JSON shape or null. Low confidence goes to
 * the needs-review queue — it is never silently saved as a subscription.
 */

import { z } from 'zod';

export const ExtractedChargeSchema = z.object({
  merchant: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  chargedAt: z.string(), // ISO date
  cycleHint: z
    .enum(['weekly', 'monthly', 'quarterly', 'yearly', 'one_time', 'unknown'])
    .default('unknown'),
  confidence: z.number().min(0).max(1),
});

export type ExtractedCharge = z.infer<typeof ExtractedChargeSchema>;

/** Below this, the item goes to the needs-review queue, never auto-saved. */
export const AUTO_ACCEPT_CONFIDENCE = 0.8;

export const EXTRACTION_SYSTEM_PROMPT = `You extract billing information from a single email.

Return ONLY a JSON object with this exact shape, or the JSON value null if the email is not a receipt, invoice, renewal notice, or payment confirmation:

{
  "merchant": "canonical service name, e.g. 'Netflix', not 'NETFLIX.COM *8471'",
  "amount": 12.99,
  "currency": "EUR",
  "chargedAt": "2026-08-01",
  "cycleHint": "monthly | weekly | quarterly | yearly | one_time | unknown",
  "confidence": 0.0 to 1.0
}

Rules:
- Extract only what the email states. Never guess an amount or date.
- If the email mentions a renewal price different from the charged price, use the charged price.
- Marketing emails, shipping notifications, and login alerts are null.
- One-time purchases get cycleHint "one_time".
- Lower your confidence when the merchant name, amount, or date is unclear.
- No markdown, no explanation, no text outside the JSON.`;

export function parseExtraction(raw: string): ExtractedCharge | null {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  if (cleaned === 'null') return null;
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed === null) return null;
    const result = ExtractedChargeSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
