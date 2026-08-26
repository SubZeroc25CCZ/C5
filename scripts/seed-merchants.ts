// Idempotent DB seed: upserts every merchant from data/merchants.seed.json
// by slug into Cloudflare D1. Run with `pnpm db:seed` (requires
// CLOUDFLARE_* env, see .env.example).

import { db } from "../src/db/client";
import { merchants } from "../src/db/schema";
import { loadSeedMerchants, slugify } from "../src/merchants/seed";

async function main() {
  const seeds = loadSeedMerchants();
  for (const seed of seeds) {
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
      })
      .onConflictDoUpdate({
        target: merchants.slug,
        set: {
          name: seed.name,
          domains: seed.domains,
          category: seed.category,
          cancelUrl: seed.cancel_url,
          cancelMethod: seed.cancel_method,
          difficulty: seed.difficulty,
        },
      });
  }
  console.log(`Seeded ${seeds.length} merchants.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
