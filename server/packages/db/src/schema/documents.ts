import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { vehicle } from "./vehicles";

export const documentTypeEnum = pgEnum("document_type", [
  "id",
  "proof_of_ownership",
  "other",
]);

export const vehicleDocument = pgTable("vehicle_document", {
  id: text("id").primaryKey(),
  vehicleId: text("vehicle_id")
    .notNull()
    .references(() => vehicle.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),
  /** base64 data URL or remote URL */
  fileUrl: text("file_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
