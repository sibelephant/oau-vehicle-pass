import { createAuthClient } from "better-auth/client";
import { API_BASE } from "./api";

export const authClient = createAuthClient({
  baseURL: API_BASE,
  fetchOptions: {
    credentials: "include",
  },
});

export type UserRole = "driver" | "gate_officer" | "admin";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string;
}
