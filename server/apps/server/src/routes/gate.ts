import { Router } from "express";
import { jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { accessLog } from "@oau-vehicle-pass/db/schema/vehicles";

import { requireRole } from "../middleware/roles";
import { normalizePlate, recognizePlateFromImage } from "../services/anpr";
import { db } from "../services";
import { getSecret } from "./passes";

const router = Router();

// All gate routes require gate_officer or admin
const gateAuth = requireRole("gate_officer", "admin");

// ─── QR Scan ──────────────────────────────────────────────────────────────────

/** POST /api/gate/scan-qr — gate officer scans a QR code */
router.post("/scan-qr", gateAuth, async (req, res) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "token required" });
    return;
  }

  const officerId = req.currentUser!.id;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const pass = await db.query.vehiclePass.findFirst({
      where: { id: payload.passId as string },
      with: { vehicle: true },
    });

    const isValid =
      pass &&
      !pass.isRevoked &&
      pass.vehicle?.status === "approved";

    const decision = isValid ? "granted" : "denied";
    const reason = !pass
      ? "No matching pass"
      : pass.isRevoked
        ? "Pass has been revoked"
        : pass.vehicle?.status === "blacklisted"
          ? "Vehicle is blacklisted"
          : pass.vehicle?.status !== "approved"
            ? `Vehicle status: ${pass.vehicle?.status}`
            : undefined;

    await db.insert(accessLog).values({
      id: randomUUID(),
      vehicleId: pass?.vehicleId ?? null,
      plateNumber: pass?.vehicle?.plateNumber ?? null,
      gateOfficerId: officerId,
      channel: "qr",
      decision,
      overrideReason: reason,
    });

    res.json({ decision, reason, vehicle: pass?.vehicle ?? null });
  } catch {
    await db.insert(accessLog).values({
      id: randomUUID(),
      vehicleId: null,
      plateNumber: null,
      gateOfficerId: officerId,
      channel: "qr",
      decision: "denied",
      overrideReason: "Invalid or expired QR token",
    });
    res.json({ decision: "denied", reason: "Invalid or expired QR code" });
  }
});

// ─── Plate Scan & ANPR ────────────────────────────────────────────────────────

const plateScanSchema = z.object({
  plateNumber: z.string().optional(),
  plateImageBase64: z.string().optional(),
  plateImageUrl: z.string().optional(),
});

/** POST /api/gate/anpr — runs OCR/ANPR on captured camera photo and returns recognized plate */
router.post("/anpr", gateAuth, async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  const anpr = await recognizePlateFromImage(imageBase64);
  const detectedPlate = anpr.detectedPlate;

  if (!detectedPlate) {
    res.json({
      detectedPlate: null,
      confidence: anpr.confidence,
      rawText: anpr.rawText,
      vehicle: null,
      decision: "denied",
      reason: "Could not detect a clear license plate. Please realign the camera or type manually.",
    });
    return;
  }

  const cleanSearch = normalizePlate(detectedPlate);
  const allVehicles = await db.query.vehicle.findMany();
  const v = allVehicles.find((cand) => normalizePlate(cand.plateNumber) === cleanSearch) ?? null;

  res.json({
    detectedPlate,
    confidence: anpr.confidence,
    rawText: anpr.rawText,
    vehicle: v,
    decision: v ? (v.status === "approved" ? "granted" : "denied") : "denied",
    reason: !v
      ? "Vehicle not registered"
      : v.status === "blacklisted"
        ? "Vehicle is blacklisted"
        : v.status !== "approved"
          ? `Vehicle status: ${v.status}`
          : undefined,
  });
});

/** POST /api/gate/scan-plate — gate officer submits a plate or image for ANPR verification & logging */
router.post("/scan-plate", gateAuth, async (req, res) => {
  const parsed = plateScanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  let { plateNumber, plateImageBase64, plateImageUrl } = parsed.data;
  const officerId = req.currentUser!.id;

  // If no plateNumber was given directly, run ANPR on imageBase64
  if (!plateNumber && plateImageBase64) {
    const anpr = await recognizePlateFromImage(plateImageBase64);
    if (anpr.detectedPlate) {
      plateNumber = anpr.detectedPlate;
    }
  }

  if (!plateNumber) {
    res.status(400).json({ error: "Valid plate number or plate image required" });
    return;
  }

  const cleanSearch = normalizePlate(plateNumber);
  const allVehicles = await db.query.vehicle.findMany();
  const v = allVehicles.find((cand) => normalizePlate(cand.plateNumber) === cleanSearch) ?? null;

  const decision =
    v?.status === "approved" ? "granted" : "denied";
  const reason = !v
    ? "Vehicle not registered"
    : v.status === "blacklisted"
      ? "Vehicle is blacklisted"
      : v.status !== "approved"
        ? `Vehicle status: ${v.status}`
        : undefined;

  await db.insert(accessLog).values({
    id: randomUUID(),
    vehicleId: v?.id ?? null,
    plateNumber: v?.plateNumber ?? plateNumber.toUpperCase().trim(),
    gateOfficerId: officerId,
    channel: "anpr",
    decision,
    overrideReason: reason,
    plateImageUrl: plateImageUrl || (plateImageBase64 ? "data:image/jpeg;base64,captured" : null),
  });

  res.json({ decision, reason, vehicle: v ?? null, plateNumber: v?.plateNumber ?? plateNumber });
});

// ─── Manual Override ──────────────────────────────────────────────────────────

const overrideSchema = z.object({
  vehicleId: z.string().optional(),
  plateNumber: z.string().optional(),
  decision: z.enum(["granted", "denied"]),
  reason: z.string().min(5, "Please provide a reason for the override"),
});

/** POST /api/gate/override — gate officer manually overrides a decision */
router.post("/override", gateAuth, async (req, res) => {
  const parsed = overrideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { vehicleId, plateNumber, decision, reason } = parsed.data;

  const [log] = await db
    .insert(accessLog)
    .values({
      id: randomUUID(),
      vehicleId: vehicleId ?? null,
      plateNumber: plateNumber ?? null,
      gateOfficerId: req.currentUser!.id,
      channel: "manual",
      decision,
      overrideReason: reason,
    })
    .returning();

  res.json(log);
});

/** GET /api/gate/today — today's access log for the gate officer */
router.get("/today", gateAuth, async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const logs = await db.query.accessLog.findMany({
    where: (l, { gte }) => gte(l.timestamp, todayStart),
    with: { vehicle: true },
    orderBy: (l, { desc }) => [desc(l.timestamp)],
    limit: 100,
  });

  res.json(logs);
});

// ─── Offline Synchronization ──────────────────────────────────────────────────

/**
 * GET /api/gate/sync — Gate App downloads current whitelist & blacklist for offline tolerance
 */
router.get("/sync", gateAuth, async (_req, res) => {
  const now = new Date();

  // Active unexpired, unrevoked passes
  const activePasses = await db.query.vehiclePass.findMany({
    where: (p, { and, eq, gt }) => and(eq(p.isRevoked, false), gt(p.expiresAt, now)),
    with: { vehicle: true },
  });

  const whitelist = activePasses
    .filter((p) => p.vehicle && p.vehicle.status === "approved")
    .map((p) => ({
      passId: p.id,
      vehicleId: p.vehicleId,
      plateNumber: p.vehicle!.plateNumber,
      category: p.vehicle!.category,
      ownerName: p.vehicle!.ownerName,
      make: p.vehicle!.make,
      model: p.vehicle!.model,
      color: p.vehicle!.color,
      expiresAt: p.expiresAt.toISOString(),
    }));

  // All blacklisted vehicles
  const blacklisted = await db.query.vehicle.findMany({
    where: (v, { eq }) => eq(v.status, "blacklisted"),
  });

  const blacklist = blacklisted.map((v) => ({
    plateNumber: v.plateNumber,
    reason: v.rejectionReason,
  }));

  res.json({
    syncTimestamp: now.toISOString(),
    whitelist,
    blacklist,
  });
});

/**
 * POST /api/gate/sync-logs — Upload access events recorded offline
 */
router.post("/sync-logs", gateAuth, async (req, res) => {
  const { logs } = req.body as {
    logs?: Array<{
      id?: string;
      vehicleId?: string | null;
      plateNumber?: string | null;
      channel: "qr" | "anpr" | "manual";
      decision: "granted" | "denied";
      overrideReason?: string | null;
      timestamp?: string;
    }>;
  };

  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    res.json({ syncedCount: 0 });
    return;
  }

  const officerId = req.currentUser!.id;
  let inserted = 0;

  for (const item of logs) {
    try {
      await db.insert(accessLog).values({
        id: item.id || randomUUID(),
        vehicleId: item.vehicleId ?? null,
        plateNumber: item.plateNumber ?? null,
        gateOfficerId: officerId,
        channel: item.channel,
        decision: item.decision,
        overrideReason: item.overrideReason ? `[Offline] ${item.overrideReason}` : "[Offline Record]",
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
      });
      inserted++;
    } catch {
      // Continue inserting remaining batch
    }
  }

  res.json({ syncedCount: inserted });
});

export default router;
