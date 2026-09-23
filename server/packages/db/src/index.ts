import { drizzle } from "drizzle-orm/node-postgres";

import { withSslMode, type DatabaseConfig } from "./config";
import { relations } from "./relations";

export function createDb(env: DatabaseConfig) {
  const dbUrl = env?.DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is not set! Please define the DATABASE_URL environment variable in your deployment platform (e.g. Render Dashboard -> Environment)."
    );
  }
  return drizzle(withSslMode(dbUrl), { relations });
}

export type Database = ReturnType<typeof createDb>;
