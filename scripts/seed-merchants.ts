// Idempotent DB seed: upserts every merchant from data/merchants.seed.json
// by slug into Cloudflare D1. Run with `pnpm db:seed` (requires
// CLOUDFLARE_* env, see .env.example).

import { sql, type AnyColumn } from "drizzle-orm";
import { db } from "../src/db/client";
import { merchants } from "../src/db/schema";
import { loadSeedMerchants, slugify } from "../src/merchants/seed";

// The seed file's own rule is that a cancel_url is null until verified
// against the merchant's own domain during build, so a URL that survives
// into the seed already carries a verification. Recording it here is what
// makes it visible to customers (§4.6) — a seeded URL with no verification
// row would be silently stripped by `customerMerchant`.
const SEED_VERIFICATION =
  "Editorial seed — verified against the merchant's own domain at build time.";

/**
 * In an ON CONFLICT DO UPDATE, an unqualified column reference is the row
 * already in the table. So: keep what's there when a human admin verified
 * it (verified_by is set and isn't "seed"), otherwise take the seed value.
 */
function keepAdminValue<T>(column: AnyColumn, seedValue: T) {
  return sql`case
    when ${merchants.cancelUrlVerifiedBy} is not null
     and ${merchants.cancelUrlVerifiedBy} <> 'seed'
    then ${column}
    else ${seedValue}
  end`;
}

async function main() {
  const seeds = loadSeedMerchants();
  const verifiedAt = new Date();
  let verified = 0;
  for (const seed of seeds) {
    const verification = seed.cancel_url
      ? {
          cancelUrlVerifiedAt: verifiedAt,
          cancelUrlVerifiedBy: "seed",
          cancelUrlSource: SEED_VERIFICATION,
        }
      : { cancelUrlVerifiedAt: null, cancelUrlVerifiedBy: null, cancelUrlSource: null };
    if (seed.cancel_url) verified += 1;

    await db
      .insert(merchants)
      .values({
        name: seed.name,
        slug: slugify(seed.name),
        domains: seed.domains,
        category: seed.category,
        cancelUrl: seed.cancel_url,
        cancelMethod: seed.cancel_method,
        difficulty: seed.difficulty,
        ...verification,
      })
      .onConflictDoUpdate({
        target: merchants.slug,
        set: {
          name: seed.name,
          domains: seed.domains,
          category: seed.category,
          cancelMethod: seed.cancel_method,
          difficulty: seed.difficulty,
          // Cancellation research an admin did in the panel outsurvives a
          // re-seed: the editorial file only owns a merchant's cancel URL
          // while no human has verified a better one.
          cancelUrl: keepAdminValue(merchants.cancelUrl, seed.cancel_url),
          cancelUrlVerifiedAt: keepAdminValue(
            merchants.cancelUrlVerifiedAt,
            verification.cancelUrlVerifiedAt,
          ),
          cancelUrlVerifiedBy: keepAdminValue(
            merchants.cancelUrlVerifiedBy,
            verification.cancelUrlVerifiedBy,
          ),
          cancelUrlSource: keepAdminValue(
            merchants.cancelUrlSource,
            verification.cancelUrlSource,
          ),
        },
      });
  }
  console.log(`Seeded ${seeds.length} merchants (${verified} with a verified cancel URL).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
