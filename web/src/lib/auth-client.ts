import { createAuthClient } from "better-auth/client";
import { sentinelClient } from "@better-auth/infra/client";

// In development, the Vite server proxies /api to http://localhost:3000
// Or uses the explicit URL if direct CORS is configured
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: API_BASE,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [sentinelClient()],
});

export type UserRole = "driver" | "gate_officer" | "admin";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string;
}
