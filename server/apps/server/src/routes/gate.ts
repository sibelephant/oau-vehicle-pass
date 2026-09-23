import { Router } from "express";
import { jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { accessLog } from "@oau-vehicle-pass/db/schema/vehicles";

import { requireRole } from "../middleware/roles";
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

// ─── Plate Scan ───────────────────────────────────────────────────────────────

const plateScanSchema = z.object({
  plateNumber: z.string().min(2).max(20).transform((v) => v.toUpperCase().trim()),
  plateImageUrl: z.string().optional(),
});

/** POST /api/gate/scan-plate — gate officer submits a plate for ANPR matching */
router.post("/scan-plate", gateAuth, async (req, res) => {
  const parsed = plateScanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { plateNumber, plateImageUrl } = parsed.data;
  const officerId = req.currentUser!.id;

  const v = await db.query.vehicle.findFirst({
    where: { plateNumber },
  });

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
    plateNumber,
    gateOfficerId: officerId,
    channel: "anpr",
    decision,
    plateImageUrl,
  });

  res.json({ decision, reason, vehicle: v ?? null });
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
    with: { vehicle: true },
    orderBy: (l, { desc }) => [desc(l.timestamp)],
    limit: 100,
  });

  // Filter to today in JS (simpler than raw SQL for prototype)
  const todayLogs = logs.filter((l) => l.timestamp >= todayStart);
  res.json(todayLogs);
});

export default router;
