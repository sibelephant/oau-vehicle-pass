import { createAuth } from "@oau-vehicle-pass/auth";
import { createDb } from "@oau-vehicle-pass/db";

import { ENV } from "./env.server";

// Ensure process.env values are respected even in production bundles
const effectiveEnv = {
  ...ENV,
  DATABASE_URL: ENV?.DATABASE_URL || process.env.DATABASE_URL || "",
  BETTER_AUTH_SECRET: ENV?.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET || "",
  BETTER_AUTH_URL: ENV?.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "",
  CORS_ORIGIN: ENV?.CORS_ORIGIN || process.env.CORS_ORIGIN || "",
};

export const db = createDb(effectiveEnv);
export const auth = createAuth(effectiveEnv, db);
