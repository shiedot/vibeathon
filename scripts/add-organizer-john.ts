/**
 * Re-add John Lyotier as an organizer.
 *
 * Usage: pnpm tsx scripts/add-organizer-john.ts
 *
 * - Idempotent: upserts by email (case-insensitive).
 * - Promotes an existing row to `organizer` or inserts a fresh organizer row.
 */
import "dotenv/config";
import { eq, ilike } from "drizzle-orm";
import { db } from "../src/db/client";
import { participants } from "../src/db/schema";

const ORGANIZER = {
  name: "John Lyotier",
  email: "john@travelai.com",
  employeeId: "organizer-john-lyotier",
  department: "ORGANIZER",
} as const;

async function main() {
  const [existing] = await db
    .select()
    .from(participants)
    .where(ilike(participants.email, ORGANIZER.email))
    .limit(1);

  if (existing) {
    await db
      .update(participants)
      .set({
        role: "organizer",
        name: ORGANIZER.name,
        email: ORGANIZER.email,
        department: existing.department || ORGANIZER.department,
        personalBankroll: 0,
      })
      .where(eq(participants.id, existing.id));
    console.log(
      `Updated existing row ${existing.id} (${existing.email}) → organizer`,
    );
  } else {
    const [inserted] = await db
      .insert(participants)
      .values({
        name: ORGANIZER.name,
        email: ORGANIZER.email,
        department: ORGANIZER.department,
        employeeId: ORGANIZER.employeeId,
        role: "organizer",
        setupStatus: "ready",
        toolInstalledTested: true,
        completedTestPr: true,
        licenseStatus: "active",
        personalBankroll: 0,
      })
      .returning({ id: participants.id });
    console.log(`Inserted organizer row ${inserted.id} for ${ORGANIZER.email}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
