// Loader for the editorial merchant seed (data/merchants.seed.json).
// Rule from the seed file itself: cancel_url stays null until verified
// during build — never ship an unverified URL.

import seedFile from "../../data/merchants.seed.json";
import type { MerchantRecord } from "@/ingestion/types";

export interface SeedMerchant {
  name: string;
  domains: string[];
  category: string;
  cancel_method: "url" | "email" | "phone" | "unknown";
  cancel_url: string | null;
  difficulty: number;
}

export function loadSeedMerchants(): SeedMerchant[] {
  return (seedFile as { merchants: SeedMerchant[] }).merchants;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** In-memory MerchantRecords (ids are seed-array positions until DB-assigned). */
export function seedAsRecords(): MerchantRecord[] {
  return loadSeedMerchants().map((seed, index) => ({
    id: index + 1,
    name: seed.name,
    slug: slugify(seed.name),
    domains: seed.domains,
    category: seed.category,
    cancelUrl: seed.cancel_url,
    cancelMethod: seed.cancel_method,
    difficulty: seed.difficulty,
  }));
}
