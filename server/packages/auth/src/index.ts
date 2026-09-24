import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@oau-vehicle-pass/db";
import * as schema from "@oau-vehicle-pass/db/schema/auth";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { dash } from "@better-auth/infra";
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
      "BETTER_AUTH_SECRET is not set! Please define BETTER_AUTH_SECRET in your environment variables.",
    );
  }

  // CORS_ORIGIN may be a single URL or a comma-separated list of URLs
  const corsOrigins = corsOrigin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = [
    ...corsOrigins,
    // Production origins — always trusted regardless of env var
    "https://oau-vehicle-pass.vercel.app",
    // Local development
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8081",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:8081",
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
          input: false, // disallow arbitrary role assignment on public sign-up
        },
      },
    },
    plugins: [expo(), bearer(), dash()],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
