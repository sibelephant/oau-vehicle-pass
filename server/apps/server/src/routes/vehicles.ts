import { eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { vehicle } from "@oau-vehicle-pass/db/schema/vehicles";
import { vehicleDocument } from "@oau-vehicle-pass/db/schema/documents";

import { requireAuth, requireRole } from "../middleware/roles";
import { db } from "../services";

const router = Router();

async function attachDocuments<T extends { id: string }>(vehicles: T[]) {
  if (vehicles.length === 0)
    return vehicles.map((item) => ({ ...item, documents: [] }));

  const documents = await db
    .select()
    .from(vehicleDocument)
    .where(
      inArray(
        vehicleDocument.vehicleId,
        vehicles.map((item) => item.id),
      ),
    );
  const documentsByVehicle = new Map<string, typeof documents>();

  for (const document of documents) {
    const vehicleDocuments = documentsByVehicle.get(document.vehicleId) ?? [];
    vehicleDocuments.push(document);
    documentsByVehicle.set(document.vehicleId, vehicleDocuments);
  }

  return vehicles.map((item) => ({
    ...item,
    documents: documentsByVehicle.get(item.id) ?? [],
  }));
}

// ─── Validation ──────────────────────────────────────────────────────────────

const registerSchema = z.object({
  plateNumber: z
    .string()
    .min(2)
    .max(20)
    .transform((v) => v.toUpperCase().trim()),
  category: z.enum(["staff", "student", "visitor", "commercial"]),
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  color: z.string().max(40).optional(),
  ownerName: z.string().min(2).max(120),
  ownerContact: z.string().min(6).max(20),
  documents: z
    .array(
      z.object({
        type: z.enum(["id", "proof_of_ownership", "other"]),
        fileUrl: z.string().min(1),
      }),
    )
    .optional(),
});

// ─── Driver routes ───────────────────────────────────────────────────────────

/** POST /api/vehicles — driver registers a new vehicle */
router.post("/", requireAuth, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { documents, ...vehicleData } = parsed.data;
  const userId = req.currentUser!.id;
  const vehicleId = randomUUID();

  const [newVehicle] = await db
    .insert(vehicle)
    .values({ id: vehicleId, ...vehicleData, userId })
    .returning();

  if (documents?.length) {
    await db
      .insert(vehicleDocument)
      .values(
        documents.map((doc) => ({ id: randomUUID(), vehicleId, ...doc })),
      );
  }

  res.status(201).json(newVehicle);
});

/** GET /api/vehicles/my — driver fetches their own vehicles */
router.get("/my", requireAuth, async (req, res) => {
  // Drizzle RC4 relational query: `where` in findMany uses plain object filter
  const vehicles = await db.query.vehicle.findMany({
    where: { userId: req.currentUser!.id },
    with: {
      passes: {
        where: { isRevoked: false },
        orderBy: (p, { desc }) => [desc(p.issuedAt)],
        limit: 1,
      },
    },
    orderBy: (v, { desc }) => [desc(v.createdAt)],
  });
  res.json(await attachDocuments(vehicles));
});

/** GET /api/vehicles/:id — driver fetches a single vehicle */
router.get("/:id", requireAuth, async (req, res) => {
  const v = await db.query.vehicle.findFirst({
    where: { id: req.params.id as string },
  });
  if (!v || v.userId !== req.currentUser!.id) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(v);
});

// ─── Admin routes ────────────────────────────────────────────────────────────

/** GET /api/vehicles — admin/officer lists all vehicles */
router.get("/", requireRole("admin", "gate_officer"), async (_req, res) => {
  const vehicles = await db.query.vehicle.findMany({
    with: {
      passes: { where: { isRevoked: false }, limit: 1 },
    },
    orderBy: (v, { desc }) => [desc(v.createdAt)],
  });
  res.json(await attachDocuments(vehicles));
});

/** PATCH /api/vehicles/:id/status — admin approves or rejects */
router.patch("/:id/status", requireRole("admin"), async (req, res) => {
  const { status, rejectionReason } = req.body as {
    status: "approved" | "rejected";
    rejectionReason?: string;
  };

  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be approved or rejected" });
    return;
  }

  const [updated] = await db
    .update(vehicle)
    .set({ status, rejectionReason, updatedAt: new Date() })
    .where(eq(vehicle.id, req.params.id as string))
    .returning();

  res.json(updated);
});

/** PATCH /api/vehicles/:id/blacklist — admin blacklists a vehicle */
router.patch("/:id/blacklist", requireRole("admin"), async (req, res) => {
  const [updated] = await db
    .update(vehicle)
    .set({ status: "blacklisted", updatedAt: new Date() })
    .where(eq(vehicle.id, req.params.id as string))
    .returning();
  res.json(updated);
});

export default router;
