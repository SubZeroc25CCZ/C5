// Stage 1 (§5.2): sender-domain → merchant record. Deterministic, free,
// instant — expected to cover ~80% of hits before any AI is involved.

import type { MerchantRecord } from "./types";

/** Extract the sender domain from a From header ("Netflix <info@account.netflix.com>" → "account.netflix.com"). */
export function senderDomain(fromHeader: string): string | null {
  const angled = fromHeader.match(/<([^<>\s]+@[^<>\s]+)>/);
  const address = angled?.[1] ?? fromHeader.trim().match(/^[^\s<>]+@[^\s<>]+$/)?.[0];
  if (!address) return null;
  const at = address.lastIndexOf("@");
  if (at === -1) return null;
  return address.slice(at + 1).toLowerCase().replace(/\.$/, "");
}

const AMBIGUOUS = Symbol("ambiguous");

export class MerchantMatcher {
  /**
   * domain → merchant, or AMBIGUOUS when several merchants share a domain
   * (google.com serves both Google One and YouTube Premium receipts). An
   * ambiguous domain never produces a Stage 1 match — disambiguating a
   * conglomerate's receipt is exactly Stage 2's job.
   */
  private byDomain = new Map<string, MerchantRecord | typeof AMBIGUOUS>();

  constructor(merchants: MerchantRecord[]) {
    for (const merchant of merchants) {
      for (const domain of merchant.domains) {
        const normalized = domain.toLowerCase();
        const current = this.byDomain.get(normalized);
        if (current && current !== merchant) {
          this.byDomain.set(normalized, AMBIGUOUS);
        } else {
          this.byDomain.set(normalized, merchant);
        }
      }
    }
  }

  private lookup(domain: string): MerchantRecord | null {
    const found = this.byDomain.get(domain);
    return found && found !== AMBIGUOUS ? found : null;
  }

  /**
   * Match a From header to a merchant. An exact domain match wins; otherwise
   * a message from any subdomain of a known domain matches
   * (billing.netflix.com → netflix.com). No fuzzy name matching here —
   * ambiguity is Stage 2's job.
   */
  match(fromHeader: string): MerchantRecord | null {
    const domain = senderDomain(fromHeader);
    if (!domain) return null;

    const exact = this.lookup(domain);
    if (exact) return exact;
    if (this.byDomain.has(domain)) return null; // known but ambiguous

    // Walk up the subdomain chain: a.b.netflix.com → b.netflix.com → netflix.com
    const parts = domain.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (this.byDomain.has(parent)) return this.lookup(parent);
    }
    return null;
  }

  /** All known billing domains — feeds the `from:` query set (§5.1). */
  knownDomains(): string[] {
    return [...this.byDomain.keys()];
  }
}
