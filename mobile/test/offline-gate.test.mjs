import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const stubs = {
  "expo-file-system": new URL("./stub-file-system.mjs", import.meta.url).href,
  "react-native": new URL("./stub-react-native.mjs", import.meta.url).href,
};

registerHooks({
  resolve(id, context, next) {
    const stub = stubs[id];
    if (stub) return { url: stub, shortCircuit: true };
    // metro resolves extensionless relative imports, node ESM does not
    if (id.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(id)) {
      try {
        return next(`${id}.ts`, context);
      } catch {}
    }
    return next(id, context);
  },
});

const { offlineGate } = await import("../lib/offline-gate.ts");
const { files } = await import("./stub-file-system.mjs");

// ── fixtures ──────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const now = Date.now();

const seed = (whitelist, blacklist = []) => {
  files.clear();
  files.set(
    "mem://doc/gate-cache/whitelist.json",
    JSON.stringify(whitelist),
  );
  files.set(
    "mem://doc/gate-cache/blacklist.json",
    JSON.stringify(blacklist),
  );
};

const pass = (over = {}) => ({
  passId: "pass_1",
  vehicleId: "veh_1",
  plateNumber: "ABC 123 XY",
  category: "staff",
  ownerName: "Ada Okonkwo",
  expiresAt: new Date(now + 7 * DAY).toISOString(),
  ...over,
});

/** Minimal unsigned JWT — the gate never checks the signature, only the payload. */
const token = (payload) => {
  const b64 = (o) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64url");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
};

const pendingLogs = () =>
  JSON.parse(files.get("mem://doc/gate-cache/pending-logs.json") ?? "[]");

const check = (name, fn) => {
  seed([]);
  fn();
  console.log(`ok  ${name}`);
};

// ── plate path ────────────────────────────────────────────────────────────────

check("grants a whitelisted, unexpired vehicle", () => {
  seed([pass()]);
  const res = offlineGate.verifyPlateOffline("abc-123-xy");
  assert.equal(res.decision, "granted");
  assert.equal(res.isOffline, true);
  assert.equal(res.vehicle.ownerName, "Ada Okonkwo");
  assert.equal(res.plateNumber, "ABC 123 XY", "reports the cached plate");
  assert.equal(pendingLogs().length, 1);
  assert.equal(pendingLogs()[0].decision, "granted");
  assert.equal(pendingLogs()[0].channel, "anpr");
});

check("denies an unknown plate", () => {
  seed([pass()]);
  const res = offlineGate.verifyPlateOffline("ZZZ 999 ZZ");
  assert.equal(res.decision, "denied");
  assert.match(res.reason, /not found/);
  assert.equal(pendingLogs()[0].decision, "denied");
});

check("denies a blacklisted plate and keeps the reason", () => {
  seed([pass()], [{ plateNumber: "abc123xy", reason: "stolen" }]);
  const res = offlineGate.verifyPlateOffline("ABC 123 XY");
  assert.equal(res.decision, "denied");
  assert.match(res.reason, /Blacklisted: stolen/);
});

check("blacklist outranks the whitelist", () => {
  seed([pass()], [{ plateNumber: "ABC 123 XY" }]);
  const res = offlineGate.verifyPlateOffline("ABC 123 XY");
  assert.equal(res.decision, "denied");
  assert.match(res.reason, /blacklisted/i);
});

check("denies an expired cached pass", () => {
  seed([pass({ expiresAt: new Date(now - DAY).toISOString() })]);
  const res = offlineGate.verifyPlateOffline("ABC 123 XY");
  assert.equal(res.decision, "denied");
  assert.match(res.reason, /expired/i);
});

// ── QR path ───────────────────────────────────────────────────────────────────

check("grants on a valid QR payload", () => {
  seed([pass()]);
  const res = offlineGate.verifyQrOffline(
    token({ passId: "pass_1", plateNumber: "ABC 123 XY", exp: Math.floor(now / 1000) + 600 }),
  );
  assert.equal(res.decision, "granted");
  assert.equal(pendingLogs()[0].channel, "qr");
});

check("denies an expired QR payload even when the plate is cached", () => {
  seed([pass()]);
  const res = offlineGate.verifyQrOffline(
    token({ passId: "pass_1", plateNumber: "ABC 123 XY", exp: Math.floor(now / 1000) - 600 }),
  );
  assert.equal(res.decision, "denied");
  assert.match(res.reason, /expired/i);
});

check("denies a malformed token", () => {
  seed([pass()]);
  const res = offlineGate.verifyQrOffline("not-a-jwt");
  assert.equal(res.decision, "denied");
  assert.match(res.reason, /Invalid QR pass format/);
  assert.equal(pendingLogs().length, 1);
});

check("base64url payload survives the decoder", () => {
  seed([pass()]);
  // - and _ in the payload must decode to the same bytes
  const res = offlineGate.verifyQrOffline(
    token({ passId: "pass_1", plateNumber: "ABC 123 XY", note: "a?b>c~d", exp: Math.floor(now / 1000) + 600 }),
  );
  assert.equal(res.decision, "granted");
});

check("standard base64 with + / and = padding decodes too", () => {
  seed([pass()]);
  // this note makes the payload's base64 contain +, / and = padding
  const payload = { passId: "pass_1", plateNumber: "ABC 123 XY", note: "\\~\\?", exp: Math.floor(now / 1000) + 600 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  assert.ok(encoded.includes("+") && encoded.includes("/") && encoded.includes("="));
  const std = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64")}.${encoded}.sig`;
  assert.equal(offlineGate.verifyQrOffline(std).decision, "granted");
});

check("denies a passId that is not cached", () => {
  seed([pass()]);
  const res = offlineGate.verifyQrOffline(
    token({ passId: "pass_unknown", plateNumber: "ABC 123 XY", exp: Math.floor(now / 1000) + 600 }),
  );
  assert.equal(res.decision, "granted", "falls back to the plate match");
});

// ── storage ───────────────────────────────────────────────────────────────────

check("an empty cache denies everything rather than throwing", () => {
  seed([]);
  assert.equal(offlineGate.verifyPlateOffline("ABC 123 XY").decision, "denied");
  assert.equal(offlineGate.getWhitelist().length, 0);
});

check("every decision appends exactly one log", () => {
  seed([pass()], [{ plateNumber: "BAD 1 XXX" }]);
  offlineGate.verifyPlateOffline("ABC 123 XY");
  offlineGate.verifyPlateOffline("BAD 1 XXX");
  offlineGate.verifyPlateOffline("NOPE 000 XX");
  assert.equal(pendingLogs().length, 3);
  assert.deepEqual(
    pendingLogs().map((l) => l.decision),
    ["granted", "denied", "denied"],
  );
});

console.log("\noffline-gate: all checks passed");
