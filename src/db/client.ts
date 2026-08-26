// Cloudflare D1 over its REST API, wrapped in Drizzle's sqlite-proxy
// driver. Works from any host (Vercel included) with a scoped API token —
// no TCP connection, no connection pool, free tier, no card.

import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

const API_BASE = "https://api.cloudflare.com/client/v4";

interface D1RawResponse {
  success: boolean;
  errors: Array<{ message: string }>;
  result: Array<{
    success: boolean;
    results: { columns: string[]; rows: unknown[][] };
  }>;
}

async function d1Raw(sqlText: string, params: unknown[]): Promise<unknown[][]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error("Cloudflare D1 is not configured (CLOUDFLARE_* env vars missing)");
  }

  const response = await fetch(
    `${API_BASE}/accounts/${accountId}/d1/database/${databaseId}/raw`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: sqlText, params }),
    },
  );
  const data = (await response.json()) as D1RawResponse;
  if (!response.ok || !data.success) {
    const message = data.errors?.map((e) => e.message).join("; ") || response.statusText;
    throw new Error(`D1 query failed: ${message}`);
  }
  return data.result[0]?.results.rows ?? [];
}

export const db = drizzle(
  async (sqlText, params, method) => {
    const rows = await d1Raw(sqlText, params);
    if (method === "get") {
      return { rows: rows[0] ?? [] };
    }
    return { rows };
  },
  { schema },
);

export type Database = typeof db;
