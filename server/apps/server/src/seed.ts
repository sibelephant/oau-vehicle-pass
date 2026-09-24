/**
 * Seed script – creates an admin user via better-auth's server-side API.
 *
 * Usage:
 *   npx tsx src/seed.ts          # seed only (idempotent)
 *   npx tsx src/seed.ts --clear  # wipe all data, then seed
 */
import "varlock/auto-load";
import { sql } from "drizzle-orm";
import { db, auth } from "./services";
import { user as userTable } from "@oau-vehicle-pass/db/schema/auth";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = "admin@oauife.edu.ng";
const ADMIN_PASSWORD = "Admin123";
const ADMIN_NAME = "Admin";

const shouldClear = process.argv.includes("--clear");

async function clearDatabase() {
  console.log("🗑️  Clearing all tables…");

  // TRUNCATE with CASCADE handles FK dependencies in one shot.
  await db.execute(sql`
    TRUNCATE TABLE
      verification,
      vehicle_document,
      access_log,
      vehicle_pass,
      vehicle,
      session,
      account,
      "user"
    CASCADE
  `);

  console.log("✅ All tables truncated.");
}

async function seed() {
  if (shouldClear) {
    await clearDatabase();
  }

  // Check if the admin user already exists
  const existing = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log(`✅ Admin user (${ADMIN_EMAIL}) already exists — skipping.`);
    process.exit(0);
  }

  // Create the user through better-auth's server-side API so the password
  // is hashed with the same algorithm the login flow expects.
  const result = await auth.api.signUpEmail({
    body: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
    },
  });

  if (!result?.user) {
    console.error("❌ Failed to create admin user:", result);
    process.exit(1);
  }

  // better-auth's signUp doesn't apply the custom `role` field directly on the
  // user row in all versions, so ensure the role is set to "admin".
  await db
    .update(userTable)
    .set({ role: "admin" })
    .where(eq(userTable.id, result.user.id));

  console.log(`🌱 Admin user seeded successfully!`);
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role:     admin`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});

