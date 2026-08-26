// Idempotent DB seed: upserts every merchant from data/merchants.seed.json
// by slug. Run with `pnpm db:seed` (requires DATABASE_* env).

import { drizzle } from "drizzle-orm/planetscale-serverless";
import { Client } from "@planetscale/database";
import { sql } from "drizzle-orm";
import { merchants } from "../src/db/schema";
import { loadSeedMerchants, slugify } from "../src/merchants/seed";

async function main() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
  });
  const db = drizzle(client);

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
      .onDuplicateKeyUpdate({
        set: {
          name: seed.name,
          domains: seed.domains,
          category: seed.category,
          cancelUrl: seed.cancel_url,
          cancelMethod: seed.cancel_method,
          difficulty: seed.difficulty,
          // no-op update key required by MySQL syntax is avoided by listing real columns
          id: sql`id`,
        },
      });
  }
  console.log(`Seeded ${seeds.length} merchants.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
