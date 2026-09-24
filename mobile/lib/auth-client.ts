import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "./api";

export const authClient = createAuthClient({
  baseURL: API_BASE,
  plugins: [
    expoClient({
      scheme: "oauvehiclepass",
      storagePrefix: "oau_vehicle_pass",
      storage: SecureStore,
    }),
  ],
});

export type UserRole = "driver" | "gate_officer" | "admin";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string;
}
