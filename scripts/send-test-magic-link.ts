/**
 * Fire a real magic-link email at a given address. Hits the actual DB
 * (creates a row in `magic_links`) and the actual Resend API — so this is
 * the same code path a live participant would trigger.
 *
 * Usage:
 *   pnpm tsx scripts/send-test-magic-link.ts shie@travelai.com
 */
import "dotenv/config";
import { ilike } from "drizzle-orm";
import { db } from "../src/db/client";
import { participants } from "../src/db/schema";
import {
  buildMagicLinkUrl,
  createMagicLink,
  sendMagicLinkEmail,
} from "../src/server/magic-link";

async function main() {
  const email = (process.argv[2] ?? "shie@travelai.com").trim().toLowerCase();
  if (!email.includes("@")) {
    console.error(`usage: pnpm tsx scripts/send-test-magic-link.ts <email>`);
    process.exit(1);
  }

  const [row] = await db
    .select({
      id: participants.id,
      name: participants.name,
      email: participants.email,
    })
    .from(participants)
    .where(ilike(participants.email, email))
    .limit(1);

  if (!row) {
    console.error(
      `No participant found for ${email}. Seed them first or check spelling.`,
    );
    process.exit(1);
  }

  const { rawToken, expiresAt } = await createMagicLink({
    participantId: row.id,
    callbackUrl: "/",
  });
  const url = buildMagicLinkUrl(rawToken);

  console.log(`[send-test-magic-link] participant: ${row.name} <${row.email}>`);
  console.log(`[send-test-magic-link] link:        ${url}`);
  console.log(`[send-test-magic-link] expires:     ${expiresAt.toISOString()}`);

  const delivered = await sendMagicLinkEmail({
    to: row.email,
    name: row.name,
    url,
    expiresAt,
  });

  if (delivered) {
    console.log(`[send-test-magic-link] ✓ emailed via Resend`);
  } else {
    console.warn(
      `[send-test-magic-link] ✗ RESEND_API_KEY not set — link was not emailed`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
