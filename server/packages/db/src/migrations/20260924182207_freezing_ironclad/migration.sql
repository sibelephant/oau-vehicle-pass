CREATE TYPE "access_channel" AS ENUM('qr', 'anpr', 'manual');--> statement-breakpoint
CREATE TYPE "access_decision" AS ENUM('granted', 'denied');--> statement-breakpoint
CREATE TYPE "vehicle_category" AS ENUM('staff', 'student', 'visitor', 'commercial');--> statement-breakpoint
CREATE TYPE "vehicle_status" AS ENUM('pending', 'approved', 'rejected', 'blacklisted');--> statement-breakpoint
CREATE TYPE "document_type" AS ENUM('id', 'proof_of_ownership', 'other');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'driver' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_log" (
	"id" text PRIMARY KEY,
	"vehicle_id" text,
	"plate_number" text,
	"gate_officer_id" text,
	"channel" "access_channel" NOT NULL,
	"decision" "access_decision" NOT NULL,
	"override_reason" text,
	"plate_image_url" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" text PRIMARY KEY,
	"plate_number" text NOT NULL UNIQUE,
	"category" "vehicle_category" NOT NULL,
	"make" text,
	"model" text,
	"color" text,
	"owner_name" text NOT NULL,
	"owner_contact" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "vehicle_status" DEFAULT 'pending'::"vehicle_status" NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_pass" (
	"id" text PRIMARY KEY,
	"vehicle_id" text NOT NULL,
	"qr_token" text NOT NULL UNIQUE,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_document" (
	"id" text PRIMARY KEY,
	"vehicle_id" text NOT NULL,
	"type" "document_type" NOT NULL,
	"file_url" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX "access_log_vehicleId_idx" ON "access_log" ("vehicle_id");--> statement-breakpoint
CREATE INDEX "access_log_timestamp_idx" ON "access_log" ("timestamp");--> statement-breakpoint
CREATE INDEX "access_log_gateOfficerId_idx" ON "access_log" ("gate_officer_id");--> statement-breakpoint
CREATE INDEX "vehicle_userId_idx" ON "vehicle" ("user_id");--> statement-breakpoint
CREATE INDEX "vehicle_plateNumber_idx" ON "vehicle" ("plate_number");--> statement-breakpoint
CREATE INDEX "vehicle_status_idx" ON "vehicle" ("status");--> statement-breakpoint
CREATE INDEX "vehicle_pass_vehicleId_idx" ON "vehicle_pass" ("vehicle_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_vehicle_id_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_gate_officer_id_user_id_fkey" FOREIGN KEY ("gate_officer_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vehicle_pass" ADD CONSTRAINT "vehicle_pass_vehicle_id_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vehicle_document" ADD CONSTRAINT "vehicle_document_vehicle_id_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE CASCADE;