/**
 * Promote a participant to organizer, or insert a new organizer row.
 *
 * Usage:
 *   pnpm tsx scripts/promote-organizer.ts <email> [name]
 *
 * - Idempotent: upserts by email (case-insensitive).
 * - If a matching row exists, bumps role to `organizer` (and updates name if provided).
 * - Otherwise inserts a fresh organizer row with sensible defaults.
 */
import "dotenv/config";
import { eq, ilike } from "drizzle-orm";
import { db } from "../src/db/client";
import { participants } from "../src/db/schema";

type Args = { email: string; name: string | null };

function parseArgs(): Args {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error(
      `usage: pnpm tsx scripts/promote-organizer.ts <email> [name]`,
    );
    process.exit(1);
  }
  const name = nameParts.length > 0 ? nameParts.join(" ").trim() : null;
  return { email, name };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main(): Promise<void> {
  const { email, name } = parseArgs();

  const [existing] = await db
    .select()
    .from(participants)
    .where(ilike(participants.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(participants)
      .set({
        role: "organizer",
        name: name ?? existing.name,
        email,
        department: existing.department || "ORGANIZER",
        personalBankroll: 0,
      })
      .where(eq(participants.id, existing.id));
    console.log(
      `Updated existing row ${existing.id} (${existing.email}) → organizer`,
    );
    return;
  }

  const fallbackName = name ?? email.split("@")[0];
  const [inserted] = await db
    .insert(participants)
    .values({
      name: fallbackName,
      email,
      department: "ORGANIZER",
      employeeId: `organizer-${slugify(fallbackName)}`,
      role: "organizer",
      setupStatus: "ready",
      toolInstalledTested: true,
      completedTestPr: true,
      licenseStatus: "active",
      personalBankroll: 0,
    })
    .returning({ id: participants.id });
  console.log(`Inserted organizer row ${inserted.id} for ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
