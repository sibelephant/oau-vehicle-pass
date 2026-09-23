import { API_BASE } from "./auth-client";

export interface AccessLogItem {
  log: {
    id: string;
    vehicleId: string | null;
    plateNumber: string;
    channel: "qr" | "anpr" | "manual";
    decision: "granted" | "denied";
    overrideReason: string | null;
    timestamp: string;
    gateOfficerId: string | null;
    plateImageUrl: string | null;
  };
  vehicle: {
    id: string;
    plateNumber: string;
    category: "staff" | "student" | "visitor" | "commercial";
    make: string | null;
    model: string | null;
    color: string | null;
    ownerName: string;
    ownerContact: string;
    status: "pending" | "approved" | "rejected" | "blacklisted";
    rejectionReason: string | null;
  } | null;
  officerName: string | null;
}

export interface VehiclePendingItem {
  id: string;
  plateNumber: string;
  category: "staff" | "student" | "visitor" | "commercial";
  make: string | null;
  model: string | null;
  color: string | null;
  ownerName: string;
  ownerContact: string;
  status: "pending" | "approved" | "rejected" | "blacklisted";
  createdAt: string;
  documents: Array<{
    id: string;
    type: "id" | "proof_of_ownership" | "other";
    fileUrl: string;
    uploadedAt: string;
  }>;
}

export interface VehicleItem {
  id: string;
  plateNumber: string;
  category: "staff" | "student" | "visitor" | "commercial";
  make: string | null;
  model: string | null;
  color: string | null;
  ownerName: string;
  ownerContact: string;
  status: "pending" | "approved" | "rejected" | "blacklisted";
  isBlacklisted: boolean;
  blacklistReason: string | null;
  createdAt: string;
}

export interface PeakHourItem {
  hour: number;
  count: number;
}

export interface TrafficSummary {
  totalEntries: number;
  totalGranted: number;
  totalDenied: number;
  qrCount: number;
  anprCount: number;
  manualCount: number;
  peakHour: number | null;
  peakHourCount: number;
}

type BackendVehicle = Omit<VehicleItem, "isBlacklisted" | "blacklistReason"> & {
  rejectionReason: string | null;
};

function normalizeVehicle(vehicle: BackendVehicle): VehicleItem {
  return {
    ...vehicle,
    isBlacklisted: vehicle.status === "blacklisted",
    blacklistReason:
      vehicle.status === "blacklisted" ? vehicle.rejectionReason : null,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = `Request failed: ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error || errJson.message || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Reports
  getAccessLog: (
    params: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      decision?: string;
      channel?: string;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    if (params.decision) query.set("decision", params.decision);
    if (params.channel) query.set("channel", params.channel);

    return request<{ data: AccessLogItem[]; page: number; limit: number }>(
      `/api/reports/access-log?${query.toString()}`,
    );
  },

  getPeakHours: (from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<Array<{ hour: number; total: number }>>(
      `/api/reports/peak-hours?${query.toString()}`,
    ).then((rows) => ({
      data: rows.map((row) => ({ hour: row.hour, count: row.total })),
    }));
  },

  getSummary: (from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<{
      today: {
        total: number;
        granted: number;
        denied: number;
        qr: number;
        anpr: number;
        manual: number;
        peakHour: number | null;
        peakHourCount: number;
      };
    }>(`/api/reports/summary?${query.toString()}`).then(({ today }) => ({
      data: {
        totalEntries: today.total,
        totalGranted: today.granted,
        totalDenied: today.denied,
        qrCount: today.qr,
        anprCount: today.anpr,
        manualCount: today.manual,
        peakHour: today.peakHour,
        peakHourCount: today.peakHourCount,
      },
    }));
  },

  // Vehicles
  getPendingVehicles: () => {
    return request<BackendVehicle[]>("/api/vehicles").then((vehicles) => ({
      data: vehicles
        .filter((vehicle) => vehicle.status === "pending")
        .map((vehicle) => ({ ...vehicle, documents: [] })),
    }));
  },

  updateVehicleStatus: (
    id: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
  ) => {
    return request<BackendVehicle>(`/api/vehicles/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, rejectionReason }),
    }).then((vehicle) => ({ data: normalizeVehicle(vehicle) }));
  },

  getBlacklistedVehicles: () => {
    return request<BackendVehicle[]>("/api/vehicles").then((vehicles) => ({
      data: vehicles
        .filter((vehicle) => vehicle.status === "blacklisted")
        .map(normalizeVehicle),
    }));
  },

  setBlacklistStatus: (
    id: string,
    isBlacklisted: boolean,
    blacklistReason?: string,
  ) => {
    if (isBlacklisted) {
      return request<BackendVehicle>(`/api/vehicles/${id}/blacklist`, {
        method: "PATCH",
      }).then((vehicle) => ({ data: normalizeVehicle(vehicle) }));
    }

    return request<BackendVehicle>(`/api/vehicles/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "approved",
        rejectionReason: blacklistReason,
      }),
    }).then((vehicle) => ({ data: normalizeVehicle(vehicle) }));
  },
};
