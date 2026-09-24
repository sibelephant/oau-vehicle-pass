import { Platform } from "react-native";

/**
 * Base URL for the OAU Vehicle Pass API.
 * Android emulator uses 10.0.2.2 to reach host localhost.
 * Override with EXPO_PUBLIC_API_URL env variable for device testing.
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : "http://localhost:3000");

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: object;
  token?: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const { authClient } = await import("./auth-client");
    const cookie = await (authClient as any).getCookie?.();
    if (cookie) {
      headers["cookie"] = cookie;
      if (!headers["Authorization"]) {
        const match = cookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
        if (match?.[1]) {
          const rawToken = decodeURIComponent(match[1]);
          const sessionToken = rawToken.split(".")[0];
          headers["Authorization"] = `Bearer ${sessionToken}`;
        }
      }
    }
  } catch {
    // Ignore storage read error
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json: unknown = await res.json();
      if (typeof json === "object" && json !== null && "error" in json) {
        const error = json.error;
        if (typeof error === "string") message = error;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export type VehicleCategory = "staff" | "student" | "visitor" | "commercial";
export type VehicleStatus = "pending" | "approved" | "rejected" | "blacklisted";

export interface Vehicle {
  id: string;
  plateNumber: string;
  category: VehicleCategory;
  make?: string;
  model?: string;
  color?: string;
  ownerName: string;
  ownerContact: string;
  status: VehicleStatus;
  rejectionReason?: string;
  createdAt: string;
  passes?: VehiclePass[];
}

export interface VehiclePass {
  id: string;
  vehicleId: string;
  qrToken: string;
  issuedAt: string;
  expiresAt: string;
  isRevoked: boolean;
  token?: string;
}

export interface AccessLog {
  id: string;
  vehicleId?: string;
  plateNumber?: string;
  channel: "qr" | "anpr" | "manual";
  decision: "granted" | "denied";
  overrideReason?: string;
  timestamp: string;
  vehicle?: Vehicle;
}

export interface RegisterVehicleData {
  plateNumber: string;
  category: VehicleCategory;
  make?: string;
  model?: string;
  color?: string;
  ownerName: string;
  ownerContact: string;
  documents?: {
    type: "id" | "proof_of_ownership" | "other";
    fileUrl: string;
  }[];
}

export const vehiclesApi = {
  register: (data: RegisterVehicleData) =>
    request<Vehicle>("/api/vehicles", { method: "POST", body: data }),

  myVehicles: () => request<Vehicle[]>("/api/vehicles/my"),

  getById: (id: string) => request<Vehicle>(`/api/vehicles/${id}`),
};

// ─── Passes ───────────────────────────────────────────────────────────────────

export const passesApi = {
  issue: (vehicleId: string) =>
    request<VehiclePass & { token: string }>(`/api/passes/issue/${vehicleId}`, {
      method: "POST",
    }),

  verify: (token: string) =>
    request<{ valid: boolean; reason?: string; vehicle?: Vehicle }>(
      `/api/passes/verify?token=${encodeURIComponent(token)}`,
    ),
};

// ─── Gate ─────────────────────────────────────────────────────────────────────

export interface GateDecision {
  decision: "granted" | "denied";
  reason?: string;
  vehicle?: Vehicle | null;
}

export const gateApi = {
  scanQr: (token: string) =>
    request<GateDecision>("/api/gate/scan-qr", {
      method: "POST",
      body: { token },
    }),

  scanPlate: (plateNumber: string, plateImageUrl?: string) =>
    request<GateDecision>("/api/gate/scan-plate", {
      method: "POST",
      body: { plateNumber, plateImageUrl },
    }),

  override: (data: {
    vehicleId?: string;
    plateNumber?: string;
    decision: "granted" | "denied";
    reason: string;
  }) =>
    request<AccessLog>("/api/gate/override", { method: "POST", body: data }),

  todayLog: () => request<AccessLog[]>("/api/gate/today"),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reportsApi = {
  summary: () =>
    request<{ today: { total: number; granted: number; denied: number } }>(
      "/api/reports/summary",
    ),
};
