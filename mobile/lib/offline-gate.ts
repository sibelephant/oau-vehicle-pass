import { Directory, File, Paths } from "expo-file-system";
import { gateApi, type GateDecision, type Vehicle, type VehicleCategory } from "./api";

export interface CachedPass {
  passId: string;
  vehicleId: string;
  plateNumber: string;
  category: VehicleCategory;
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

type Channel = "qr" | "anpr";
type OfflineDecision = GateDecision & { isOffline: true };

// ponytail: plain JSON files, not SecureStore. SecureStore holds ~2KB per value
// on Android, so a real whitelist overflows it and every vehicle gets denied.
const dir = new Directory(Paths.document, "gate-cache");

function file(name: string) {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return new File(dir, `${name}.json`);
}

function read<T>(name: string, fallback: T): T {
  try {
    const f = file(name);
    return f.exists ? (JSON.parse(f.textSync()) as T) : fallback;
  } catch (e) {
    console.warn(`[OfflineGate] Failed to read ${name}:`, e);
    return fallback;
  }
}

/** Never throws: a storage failure must not swallow a gate decision. */
function write(name: string, value: unknown) {
  try {
    file(name).write(JSON.stringify(value));
  } catch (e) {
    console.warn(`[OfflineGate] Failed to write ${name}:`, e);
  }
}

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// ponytail: hand-rolled because Hermes has no atob/btoa (facebook/hermes#1178).
// Latin-1 only: a non-ASCII payload fails to parse and the pass is denied, which
// is the safe direction. Swap in jose (already in the tree via better-auth) if a
// non-ASCII plate or owner name ever has to survive offline. The gate trusts the
// cached whitelist, not the signature. Covered by test/offline-gate.test.mjs.
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const s = token
      .split(".")[1]
      .replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"))
      .replace(/=+$/, "");
    const bytes: number[] = [];
    for (let i = 0; i < s.length; i += 4) {
      const [a, b, c, d] = [0, 1, 2, 3].map((j) => B64.indexOf(s[i + j] ?? "A"));
      bytes.push(
        (a << 2) | (b >> 4),
        ((b & 15) << 4) | (c >> 2),
        ((c & 3) << 6) | d,
      );
    }
    // last group is short: 2 chars → 1 byte, 3 chars → 2 bytes
    return JSON.parse(
      String.fromCharCode(...bytes.slice(0, Math.floor(s.length / 4) * 3 + (s.length % 4 ? s.length % 4 - 1 : 0))),
    );
  } catch {
    return null;
  }
}

const cleanPlate = (plate: string) => plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();

function toVehicle(pass: CachedPass): Vehicle {
  return {
    id: pass.vehicleId,
    plateNumber: pass.plateNumber,
    category: pass.category,
    make: pass.make ?? undefined,
    model: pass.model ?? undefined,
    color: pass.color ?? undefined,
    ownerName: pass.ownerName,
    ownerContact: "",
    status: "approved",
    createdAt: new Date().toISOString(),
  };
}

/** Appends an event to the local queue, synced on the next successful pull. */
function queueLog(log: Omit<OfflineAccessLog, "id" | "timestamp">) {
  const queue = read<OfflineAccessLog[]>("pending-logs", []);
  queue.push({
    ...log,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  });
  write("pending-logs", queue);
}

/** Blacklist → whitelist → expiry, logging every outcome. */
function verify(q: {
  plateNumber: string;
  passId?: string;
  channel: Channel;
  jwtExpired?: boolean;
}): OfflineDecision {
  const { plateNumber, channel } = q;
  const clean = cleanPlate(plateNumber);

  const deny = (reason: string, vehicleId?: string): OfflineDecision => {
    queueLog({ vehicleId, plateNumber, channel, decision: "denied", overrideReason: reason });
    return { decision: "denied", reason, plateNumber, isOffline: true };
  };

  if (q.jwtExpired) return deny("QR Pass has expired (Offline)");

  const blacklisted = read<CachedBlacklist[]>("blacklist", []).find(
    (b) => cleanPlate(b.plateNumber) === clean,
  );
  if (blacklisted) {
    return deny(
      blacklisted.reason
        ? `Blacklisted: ${blacklisted.reason}`
        : "Vehicle is blacklisted (Offline)",
    );
  }

  const pass = read<CachedPass[]>("whitelist", []).find(
    (w) => (q.passId && w.passId === q.passId) || cleanPlate(w.plateNumber) === clean,
  );
  if (!pass) return deny("Vehicle not found in local offline whitelist");

  if (new Date(pass.expiresAt).getTime() < Date.now()) {
    return deny("Pass expired in whitelist (Offline)", pass.vehicleId);
  }

  queueLog({
    vehicleId: pass.vehicleId,
    plateNumber: pass.plateNumber,
    channel,
    decision: "granted",
    overrideReason: "Verified against local offline cache",
  });
  return { decision: "granted", vehicle: toVehicle(pass), plateNumber: pass.plateNumber, isOffline: true };
}

export const offlineGate = {
  /** Pulls the whitelist/blacklist snapshot and flushes queued logs. */
  async syncFromServer() {
    const snapshot = await gateApi.getSyncSnapshot();
    write("whitelist", snapshot.whitelist);
    write("blacklist", snapshot.blacklist);
    await this.pushPendingLogs();
    return {
      whitelistCount: snapshot.whitelist.length,
      blacklistCount: snapshot.blacklist.length,
    };
  },

  getWhitelist: () => read<CachedPass[]>("whitelist", []),
  getPendingCount: () => read<OfflineAccessLog[]>("pending-logs", []).length,

  queueLog,

  verifyQrOffline: (token: string): OfflineDecision => {
    const payload = decodeJwtPayload(token);
    if (!payload) {
      const reason = "Invalid QR pass format (Offline)";
      queueLog({ channel: "qr", decision: "denied", overrideReason: reason });
      return { decision: "denied", reason, isOffline: true };
    }
    return verify({
      plateNumber: payload.plateNumber ?? "",
      passId: payload.passId,
      channel: "qr",
      jwtExpired: !!payload.exp && payload.exp < Math.floor(Date.now() / 1000),
    });
  },

  verifyPlateOffline: (plateNumber: string) =>
    verify({ plateNumber, channel: "anpr" }),

  async pushPendingLogs() {
    const queue = read<OfflineAccessLog[]>("pending-logs", []);
    if (!queue.length) return 0;
    try {
      const { syncedCount } = await gateApi.syncOfflineLogs(queue);
      if (syncedCount > 0) file("pending-logs").delete();
      return syncedCount;
    } catch {
      // Still offline, will retry next sync
      return 0;
    }
  },
};
