import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@oau-vehicle-pass/db";
import * as schema from "@oau-vehicle-pass/db/schema/auth";
import { betterAuth } from "better-auth";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
};

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = [],
) {
  const secret = env?.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET;
  const baseURL = env?.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL;
  const corsOrigin = env?.CORS_ORIGIN || process.env.CORS_ORIGIN || "";

  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set! Please define BETTER_AUTH_SECRET in your environment variables."
    );
  }

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [corsOrigin, ...desktopOrigins].filter(Boolean),
    emailAndPassword: { enabled: true },
    secret,
    baseURL: baseURL || "http://localhost:3000",
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "driver",
          input: true, // allow setting role on sign-up
        },
      },
    },
    plugins: [],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
