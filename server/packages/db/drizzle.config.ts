import { defineConfig } from "drizzle-kit";
import "varlock/auto-load";

import { withSslMode } from "./src/config";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ? withSslMode(process.env.DATABASE_URL) : "",
  },
});
