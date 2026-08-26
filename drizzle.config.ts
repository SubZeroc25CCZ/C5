import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.DATABASE_HOST ?? "",
    user: process.env.DATABASE_USERNAME ?? "",
    password: process.env.DATABASE_PASSWORD ?? "",
    database: process.env.DATABASE_NAME ?? "subzero",
    ssl: { rejectUnauthorized: true },
  },
});
