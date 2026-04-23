/**
 * Set personal_bankroll = 0 for all organizers (idempotent).
 *
 * Usage: pnpm tsx scripts/zero-organizer-bankrolls.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { participants } from "../src/db/schema";

async function main(): Promise<void> {
  const updated = await db
    .update(participants)
    .set({ personalBankroll: 0 })
    .where(eq(participants.role, "organizer"))
    .returning({ id: participants.id, name: participants.name, email: participants.email });
  console.log(`Set bankroll to 0 for ${updated.length} organizer(s):`);
  for (const r of updated) {
    console.log(`  - ${r.name} <${r.email}>`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
