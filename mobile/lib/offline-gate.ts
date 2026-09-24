import * as SecureStore from "expo-secure-store";
import { gateApi, type GateDecision, type Vehicle } from "./api";

export interface CachedPass {
  passId: string;
  vehicleId: string;
  plateNumber: string;
  category: "staff" | "student" | "visitor" | "commercial";
  ownerName: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  expiresAt: string;
}

export interface CachedBlacklist {
  plateNumber: string;
  reason?: string | null;
}

export interface OfflineAccessLog {
  id: string;
  vehicleId?: string | null;
  plateNumber?: string | null;
  channel: "qr" | "anpr" | "manual";
  decision: "granted" | "denied";
  overrideReason?: string | null;
  timestamp: string;
}

export interface SyncSnapshot {
  syncTimestamp: string;
  whitelist: CachedPass[];
  blacklist: CachedBlacklist[];
}

const STORAGE_KEYS = {
  WHITELIST: "oau_gate_offline_whitelist",
  BLACKLIST: "oau_gate_offline_blacklist",
  LAST_SYNC: "oau_gate_offline_last_sync",
  PENDING_LOGS: "oau_gate_offline_pending_logs",
};

function decodeBase64(str: string): string {
  if (typeof (globalThis as any).atob === "function") {
    return (globalThis as any).atob(str);
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  str = String(str).replace(/=+$/, "");
  if (str.length % 4 === 1) {
    return "";
  }
  for (
    let bc = 0, bs = 0, buffer: number, idx = 0;
    (buffer = str.charCodeAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(String.fromCharCode(buffer));
  }
  return output;
}

// Base64url decoder for JWT payload
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const decoded = decodeBase64(base64);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function cleanPlate(plate: string): string {
  return plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export const offlineGate = {
  /**
   * Downloads latest whitelist and blacklist from server and saves to SecureStore
   */
  async syncFromServer(): Promise<{ whitelistCount: number; blacklistCount: number; lastSync: string }> {
    try {
      const snapshot = await gateApi.getSyncSnapshot();
      await SecureStore.setItemAsync(STORAGE_KEYS.WHITELIST, JSON.stringify(snapshot.whitelist));
      await SecureStore.setItemAsync(STORAGE_KEYS.BLACKLIST, JSON.stringify(snapshot.blacklist));
      await SecureStore.setItemAsync(STORAGE_KEYS.LAST_SYNC, snapshot.syncTimestamp);

      // Also attempt to push any pending offline logs
      await this.pushPendingLogs();

      return {
        whitelistCount: snapshot.whitelist.length,
        blacklistCount: snapshot.blacklist.length,
        lastSync: snapshot.syncTimestamp,
      };
    } catch (e) {
      console.warn("[OfflineGate] Sync from server failed:", e);
      throw e;
    }
  },

  /**
   * Retrieves last synchronization timestamp
   */
  async getLastSyncTime(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    } catch {
      return null;
    }
  },

  /**
   * Loads cached whitelist
   */
  async getWhitelist(): Promise<CachedPass[]> {
    try {
      const json = await SecureStore.getItemAsync(STORAGE_KEYS.WHITELIST);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  },

  /**
   * Loads cached blacklist
   */
  async getBlacklist(): Promise<CachedBlacklist[]> {
    try {
      const json = await SecureStore.getItemAsync(STORAGE_KEYS.BLACKLIST);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  },

  /**
   * Verifies a QR token against locally cached whitelist and blacklist
   */
  async verifyQrOffline(token: string): Promise<GateDecision & { isOffline: boolean }> {
    const payload = decodeJwtPayload(token);
    const nowSec = Math.floor(Date.now() / 1000);

    if (!payload) {
      const res: GateDecision & { isOffline: boolean } = {
        decision: "denied",
        reason: "Invalid QR pass format (Offline)",
        isOffline: true,
      };
      await this.queueLog({
        channel: "qr",
        decision: "denied",
        overrideReason: res.reason,
      });
      return res;
    }

    // Check JWT expiry
    if (payload.exp && payload.exp < nowSec) {
      const res: GateDecision & { isOffline: boolean } = {
        decision: "denied",
        reason: "QR Pass has expired (Offline)",
        plateNumber: payload.plateNumber,
        isOffline: true,
      };
      await this.queueLog({
        plateNumber: payload.plateNumber,
        channel: "qr",
        decision: "denied",
        overrideReason: res.reason,
      });
      return res;
    }

    const plateNumber = payload.plateNumber || "";
    const cleanP = cleanPlate(plateNumber);

    // 1. Check Blacklist
    const blacklist = await this.getBlacklist();
    const blacklisted = blacklist.find((b) => cleanPlate(b.plateNumber) === cleanP);
    if (blacklisted) {
      const res: GateDecision & { isOffline: boolean } = {
        decision: "denied",
        reason: blacklisted.reason ? `Blacklisted: ${blacklisted.reason}` : "Vehicle is blacklisted (Offline)",
        plateNumber,
        isOffline: true,
      };
      await this.queueLog({
        plateNumber,
        channel: "qr",
        decision: "denied",
        overrideReason: res.reason,
      });
      return res;
    }

    // 2. Check Whitelist
    const whitelist = await this.getWhitelist();
    const matchedPass = whitelist.find(
      (w) =>
        (payload.passId && w.passId === payload.passId) ||
        (cleanP && cleanPlate(w.plateNumber) === cleanP),
    );

    if (!matchedPass) {
      const res: GateDecision & { isOffline: boolean } = {
        decision: "denied",
        reason: "Pass not found in local cached whitelist (Offline)",
        plateNumber,
        isOffline: true,
      };
      await this.queueLog({
        plateNumber,
        channel: "qr",
        decision: "denied",
        overrideReason: res.reason,
      });
      return res;
    }

    // Check pass expiration in whitelist
    if (new Date(matchedPass.expiresAt).getTime() < Date.now()) {
      const res: GateDecision & { isOffline: boolean } = {
        decision: "denied",
        reason: "Pass expired in whitelist (Offline)",
        plateNumber,
        isOffline: true,
      };
      await this.queueLog({
        vehicleId: matchedPass.vehicleId,
        plateNumber,
        channel: "qr",
        decision: "denied",
        overrideReason: res.reason,
      });
      return res;
    }

    // Verified successfully offline!
    const mockVehicle: Vehicle = {
      id: matchedPass.vehicleId,
      plateNumber: matchedPass.plateNumber,
      category: matchedPass.category,
      make: matchedPass.make || undefined,
      model: matchedPass.model || undefined,
      color: matchedPass.color || undefined,
      ownerName: matchedPass.ownerName,
      ownerContact: "",
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    const res: GateDecision & { isOffline: boolean } = {
      decision: "granted",
      vehicle: mockVehicle,
      plateNumber: matchedPass.plateNumber,
      isOffline: true,
    };

    await this.queueLog({
      vehicleId: matchedPass.vehicleId,
      plateNumber: matchedPass.plateNumber,
      channel: "qr",
      decision: "granted",
      overrideReason: "Verified against local offline cache",
    });

    return res;
  },

  /**
   * Verifies a license plate offline against local cache
   */
  async verifyPlateOffline(plateNumber: string): Promise<GateDecision & { isOffline: boolean }> {
    const cleanP = cleanPlate(plateNumber);

    // 1. Check Blacklist
    const blacklist = await this.getBlacklist();
    const blacklisted = blacklist.find((b) => cleanPlate(b.plateNumber) === cleanP);
    if (blacklisted) {
      const res: GateDecision & { isOffline: boolean } = {
        decision: "denied",
        reason: blacklisted.reason ? `Blacklisted: ${blacklisted.reason}` : "Vehicle is blacklisted (Offline)",
        plateNumber,
        isOffline: true,
      };
      await this.queueLog({
        plateNumber,
        channel: "anpr",
        decision: "denied",
        overrideReason: res.reason,
      });
      return res;
    }

    // 2. Check Whitelist
    const whitelist = await this.getWhitelist();
    const matched = whitelist.find((w) => cleanPlate(w.plateNumber) === cleanP);

    if (!matched) {
      const res: GateDecision & { isOffline: boolean } = {
        decision: "denied",
        reason: "Vehicle not found in local offline whitelist",
        plateNumber,
        isOffline: true,
      };
      await this.queueLog({
        plateNumber,
        channel: "anpr",
        decision: "denied",
        overrideReason: res.reason,
      });
      return res;
    }

    const mockVehicle: Vehicle = {
      id: matched.vehicleId,
      plateNumber: matched.plateNumber,
      category: matched.category,
      make: matched.make || undefined,
      model: matched.model || undefined,
      color: matched.color || undefined,
      ownerName: matched.ownerName,
      ownerContact: "",
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    const res: GateDecision & { isOffline: boolean } = {
      decision: "granted",
      vehicle: mockVehicle,
      plateNumber: matched.plateNumber,
      isOffline: true,
    };

    await this.queueLog({
      vehicleId: matched.vehicleId,
      plateNumber: matched.plateNumber,
      channel: "anpr",
      decision: "granted",
      overrideReason: "Verified against local offline cache",
    });

    return res;
  },

  /**
   * Appends an event to the local offline queue
   */
  async queueLog(log: Omit<OfflineAccessLog, "id" | "timestamp">): Promise<void> {
    try {
      const json = await SecureStore.getItemAsync(STORAGE_KEYS.PENDING_LOGS);
      const queue: OfflineAccessLog[] = json ? JSON.parse(json) : [];

      queue.push({
        ...log,
        id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      });

      await SecureStore.setItemAsync(STORAGE_KEYS.PENDING_LOGS, JSON.stringify(queue));
    } catch (e) {
      console.warn("[OfflineGate] Failed to queue offline log:", e);
    }
  },

  /**
   * Pushes pending offline logs to the server
   */
  async pushPendingLogs(): Promise<number> {
    try {
      const json = await SecureStore.getItemAsync(STORAGE_KEYS.PENDING_LOGS);
      if (!json) return 0;

      const queue: OfflineAccessLog[] = JSON.parse(json);
      if (!queue.length) return 0;

      const res = await gateApi.syncOfflineLogs(queue);
      if (res.syncedCount > 0) {
        // Clear or trim successfully synced logs
        await SecureStore.deleteItemAsync(STORAGE_KEYS.PENDING_LOGS);
      }
      return res.syncedCount;
    } catch {
      // Still offline, will retry next sync
      return 0;
    }
  },

  /**
   * Gets the count of pending offline logs waiting to sync
   */
  async getPendingCount(): Promise<number> {
    try {
      const json = await SecureStore.getItemAsync(STORAGE_KEYS.PENDING_LOGS);
      const queue: OfflineAccessLog[] = json ? JSON.parse(json) : [];
      return queue.length;
    } catch {
      return 0;
    }
  },
};
