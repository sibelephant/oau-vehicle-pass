import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";

import { vehiclePass } from "@oau-vehicle-pass/db/schema/vehicles";

import { requireAuth } from "../middleware/roles";
import { db } from "../services";
import { ENV } from "../env.server";

const router = Router();

/** QR passes are valid for 30 days */
const PASS_DURATION_DAYS = 30;

function getSecret() {
  return new TextEncoder().encode(ENV.BETTER_AUTH_SECRET);
}

// ─── Issue ────────────────────────────────────────────────────────────────────

/** POST /api/passes/issue/:vehicleId — issue or renew a QR pass */
router.post("/issue/:vehicleId", requireAuth, async (req, res) => {
  const v = await db.query.vehicle.findFirst({
    where: { id: req.params.vehicleId as string },
  });

  if (!v || v.userId !== req.currentUser!.id) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  if (v.status !== "approved") {
    res.status(400).json({ error: "Vehicle is not approved", status: v.status });
    return;
  }

  // Revoke any existing active pass
  await db
    .update(vehiclePass)
    .set({ isRevoked: true })
    .where(
      and(eq(vehiclePass.vehicleId, v.id), eq(vehiclePass.isRevoked, false)),
    );

  const passId = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + PASS_DURATION_DAYS);

  const token = await new SignJWT({
    passId,
    vehicleId: v.id,
    plateNumber: v.plateNumber,
    category: v.category,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecret());

  const [pass] = await db
    .insert(vehiclePass)
    .values({ id: passId, vehicleId: v.id, qrToken: token, expiresAt })
    .returning();

  res.status(201).json({ ...pass, token });
});

// ─── Verify (used by Gate App & QR scan endpoint) ────────────────────────────

/** GET /api/passes/verify?token=... — validate a QR token */
router.get("/verify", async (req, res) => {
  const token =
    typeof req.query.token === "string" ? req.query.token : undefined;

  if (!token) {
    res.status(400).json({ valid: false, reason: "token query param required" });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const passId = payload.passId as string;

    const pass = await db.query.vehiclePass.findFirst({
      where: { id: passId },
      with: { vehicle: true },
    });

    if (!pass || pass.isRevoked) {
      res
        .status(200)
        .json({ valid: false, reason: "Pass revoked or not found" });
      return;
    }

    if (pass.vehicle?.status === "blacklisted") {
      res.status(200).json({
        valid: false,
        reason: "Vehicle is blacklisted",
        vehicle: pass.vehicle,
      });
      return;
    }

    res.status(200).json({ valid: true, vehicle: pass.vehicle, pass });
  } catch {
    res.status(200).json({ valid: false, reason: "Invalid or expired token" });
  }
});

export { getSecret };
export default router;
