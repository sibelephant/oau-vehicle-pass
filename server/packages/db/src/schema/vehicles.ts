import { defineRelationsPart } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const vehicleCategoryEnum = pgEnum("vehicle_category", [
  "staff",
  "student",
  "visitor",
  "commercial",
]);

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "pending",
  "approved",
  "rejected",
  "blacklisted",
]);

export const accessChannelEnum = pgEnum("access_channel", [
  "qr",
  "anpr",
  "manual",
]);

export const accessDecisionEnum = pgEnum("access_decision", [
  "granted",
  "denied",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const vehicle = pgTable(
  "vehicle",
  {
    id: text("id").primaryKey(),
    plateNumber: text("plate_number").notNull().unique(),
    category: vehicleCategoryEnum("category").notNull(),
    make: text("make"),
    model: text("model"),
    color: text("color"),
    ownerName: text("owner_name").notNull(),
    ownerContact: text("owner_contact").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: vehicleStatusEnum("status").default("pending").notNull(),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("vehicle_userId_idx").on(table.userId),
    index("vehicle_plateNumber_idx").on(table.plateNumber),
    index("vehicle_status_idx").on(table.status),
  ],
);

export const vehiclePass = pgTable(
  "vehicle_pass",
  {
    id: text("id").primaryKey(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicle.id, { onDelete: "cascade" }),
    qrToken: text("qr_token").notNull().unique(),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    isRevoked: boolean("is_revoked").default(false).notNull(),
  },
  (table) => [index("vehicle_pass_vehicleId_idx").on(table.vehicleId)],
);

export const accessLog = pgTable(
  "access_log",
  {
    id: text("id").primaryKey(),
    vehicleId: text("vehicle_id").references(() => vehicle.id, {
      onDelete: "set null",
    }),
    plateNumber: text("plate_number"),
    gateOfficerId: text("gate_officer_id").references(() => user.id, {
      onDelete: "set null",
    }),
    channel: accessChannelEnum("channel").notNull(),
    decision: accessDecisionEnum("decision").notNull(),
    overrideReason: text("override_reason"),
    plateImageUrl: text("plate_image_url"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => [
    index("access_log_vehicleId_idx").on(table.vehicleId),
    index("access_log_timestamp_idx").on(table.timestamp),
    index("access_log_gateOfficerId_idx").on(table.gateOfficerId),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const vehicleRelations = defineRelationsPart(
  { vehicle, vehiclePass, accessLog, user },
  (r) => ({
    vehicle: {
      user: r.one.user({
        from: r.vehicle.userId,
        to: r.user.id,
      }),
      passes: r.many.vehiclePass({
        from: r.vehicle.id,
        to: r.vehiclePass.vehicleId,
      }),
      accessLogs: r.many.accessLog({
        from: r.vehicle.id,
        to: r.accessLog.vehicleId,
      }),
    },
    vehiclePass: {
      vehicle: r.one.vehicle({
        from: r.vehiclePass.vehicleId,
        to: r.vehicle.id,
      }),
    },
    accessLog: {
      vehicle: r.one.vehicle({
        from: r.accessLog.vehicleId,
        to: r.vehicle.id,
      }),
      gateOfficer: r.one.user({
        from: r.accessLog.gateOfficerId,
        to: r.user.id,
      }),
    },
  }),
);
