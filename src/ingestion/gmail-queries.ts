// Query strategy (§5.1): search, don't read. Targeted Gmail queries against
// the last 24 months, aiming to touch 200–500 messages per user — never the
// whole mailbox.

export const BACKFILL_MONTHS = 24;

/** Hard cap on messages fetched per scan, enforced by the worker. */
export const MAX_MESSAGES_PER_SCAN = 500;

const SUBJECT_QUERY =
  'subject:(receipt OR invoice OR "payment confirmation" OR renewal OR subscription)';

const PHRASE_QUERY =
  '{"has been charged" "payment was successful" "will renew" "auto-renew" "free trial ends"}';

function afterClause(now: Date): string {
  const after = new Date(now);
  after.setMonth(after.getMonth() - BACKFILL_MONTHS);
  const y = after.getFullYear();
  const m = String(after.getMonth() + 1).padStart(2, "0");
  const d = String(after.getDate()).padStart(2, "0");
  return `after:${y}/${m}/${d}`;
}

/**
 * The backfill query set. `merchantDomains` come from the merchant DB's
 * known billing domains; Gmail limits query length, so domains are chunked.
 */
export function buildBackfillQueries(merchantDomains: string[], now = new Date()): string[] {
  const after = afterClause(now);
  const queries = [
    `${after} ${SUBJECT_QUERY}`,
    `${after} ${PHRASE_QUERY}`,
    `${after} category:purchases`,
  ];
  for (const chunk of chunkDomains(merchantDomains, 25)) {
    queries.push(`${after} from:(${chunk.join(" OR ")})`);
  }
  return queries;
}

/** Delta sync (§5.4): same shape, windowed to the days since the last sync. */
export function buildDeltaQueries(
  merchantDomains: string[],
  sinceDays: number,
  now = new Date(),
): string[] {
  const days = Math.max(1, Math.ceil(sinceDays));
  const newer = `newer_than:${days}d`;
  const queries = [
    `${newer} ${SUBJECT_QUERY}`,
    `${newer} ${PHRASE_QUERY}`,
    `${newer} category:purchases`,
  ];
  for (const chunk of chunkDomains(merchantDomains, 25)) {
    queries.push(`${newer} from:(${chunk.join(" OR ")})`);
  }
  return queries;
}

function chunkDomains(domains: string[], size: number): string[][] {
  const unique = [...new Set(domains)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}
