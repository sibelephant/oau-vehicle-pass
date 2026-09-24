import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@oau-vehicle-pass/db";
import * as schema from "@oau-vehicle-pass/db/schema/auth";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { bearer } from "better-auth/plugins";

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

  const allowedOrigins = [
    corsOrigin,
    "oauvehiclepass://",
    "exp://",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8081",
    "http://10.0.2.2:3000",
    "http://10.0.2.2:8081",
    ...desktopOrigins,
  ].filter(Boolean);

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: allowedOrigins,
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
    plugins: [
      expo(),
      bearer(),
    ],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
