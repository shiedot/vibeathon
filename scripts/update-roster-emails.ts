/**
 * One-shot: replace the placeholder roster emails with the real w3engineers
 * addresses provided by the client.
 *
 * Usage:  pnpm tsx scripts/update-roster-emails.ts [--dry-run]
 *
 * - Matches participants by `employeeId = roster-<n>`.
 * - Leaves organizer rows (role != "participant") untouched.
 * - Idempotent: re-running is a no-op once emails are in sync.
 * - Case-insensitive: existing rows are treated as equal when lowercased.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { participants } from "../src/db/schema";

type RosterEmail = { rosterNo: number; name: string; email: string };

const ROSTER_EMAILS: RosterEmail[] = [
  { rosterNo: 1, name: "MD. ARIFUR RAHIM", email: "arif@w3engineers.com" },
  { rosterNo: 2, name: "MD. TAWHIDUR RAHMAN", email: "tawhid@w3engineers.com" },
  { rosterNo: 3, name: "MD MAMUN HASAN", email: "mamunhasan@w3engineers.com" },
  { rosterNo: 4, name: "SYED MAHBOOB NUR", email: "nur@w3engineers.com" },
  { rosterNo: 5, name: "S.M MAMUNUR RAHAMAN HERA", email: "hera@w3engineers.com" },
  { rosterNo: 6, name: "LUSCIOUS LARRY DAS", email: "larry@w3engineers.com" },
  { rosterNo: 7, name: "SYED MURSHID ALAM", email: "murshid@w3engineers.com" },
  { rosterNo: 8, name: "MAHMUDUL HASAN MASUM", email: "masum@w3engineers.com" },
  { rosterNo: 9, name: "MD. ABDULLAH AL MUBIN", email: "almubin@w3engineers.com" },
  { rosterNo: 10, name: "MD TOHIDUL ISLAM", email: "tohidul@w3engineers.com" },
  { rosterNo: 11, name: "MUHAMMAD IQBAL HOSSAIN", email: "iqbalhossain@w3engineers.com" },
  { rosterNo: 12, name: "SHOHEL RANA", email: "shohel@w3engineers.com" },
  { rosterNo: 13, name: "MAMUNUR RASHID", email: "mamunur.rashid@w3engineers.com" },
  { rosterNo: 14, name: "FAZLEY RABBI BISWAS", email: "fazley@w3engineers.com" },
  { rosterNo: 15, name: "PARTHA NATH", email: "partha@w3engineers.com" },
  { rosterNo: 16, name: "MD SAIFUL ISLAM", email: "saiful.islam@w3engineers.com" },
  { rosterNo: 17, name: "MD RAJIB", email: "md.rajib@w3engineers.com" },
  { rosterNo: 18, name: "MD. TARIQUL ISLAM", email: "tariqul.islam@w3engineers.com" },
  { rosterNo: 19, name: "MD. FAISAL AMIR MOSTAFA", email: "faisalamirmostaf@w3engineers.com" },
  { rosterNo: 20, name: "JAMINUR RASHID", email: "jaminur@w3engineers.com" },
  { rosterNo: 21, name: "JANNATUL NAIM", email: "jannatul@w3engineers.com" },
  { rosterNo: 22, name: "SAMRAT GHOSH", email: "samrat@w3engineers.com" },
  { rosterNo: 23, name: "IMTIAZ AHAMED SHAWN", email: "imtiaz@w3engineers.com" },
  { rosterNo: 24, name: "MD ABO BASHAR BAPPI", email: "bashar@w3engineers.com" },
  { rosterNo: 25, name: "MD. ARIFUL ISLAM", email: "ariful@w3engineers.com" },
  { rosterNo: 26, name: "MST. TUNAJJINA ISLAM SHEJUTY", email: "shejuty@w3engineers.com" },
  { rosterNo: 27, name: "KHANDAKAR ANIM HASSAN ADNAN", email: "khandakar.adnan@w3engineers.com" },
  { rosterNo: 28, name: "SALAH UDDIN", email: "salah@w3engineers.com" },
  { rosterNo: 29, name: "BAIG ASRAFUL ISLAM", email: "asraful@w3engineers.com" },
  { rosterNo: 30, name: "MAHIBUR RAHMAN", email: "mahibur@w3engineers.com" },
  { rosterNo: 31, name: "MUHAMMAD TAHSIN AMIN", email: "tahsin@w3engineers.com" },
  { rosterNo: 32, name: "MD. AL AMIN", email: "al_amin@w3engineers.com" },
  { rosterNo: 33, name: "MEHEDI HASAN", email: "mehedi.hasan@w3engineers.com" },
  { rosterNo: 34, name: "MD. SHOHAG RANA", email: "shohag@w3engineers.com" },
  { rosterNo: 35, name: "MD. MASHRUF EHSAN", email: "ehsan@w3engineers.com" },
  { rosterNo: 36, name: "MD. TAHSEEN RAHMAN", email: "tahseen@w3engineers.com" },
  { rosterNo: 37, name: "MOHAMMAD NABILUZZAMAN NELOY", email: "neloy@w3engineers.com" },
  { rosterNo: 38, name: "FAZLE RABBI", email: "fazle.rabbi@w3engineers.com" },
  { rosterNo: 39, name: "SOHAG SAGAR", email: "sagar@w3engineers.com" },
  { rosterNo: 40, name: "MD. SHAHIDUZZAMAN", email: "shahiduzzaman@w3engineers.com" },
  { rosterNo: 41, name: "SUMAIYA SIDDIQUA MUMU", email: "mumu@w3engineers.com" },
  { rosterNo: 42, name: "SURID TAHSAN MUNIR", email: "munir@w3engineers.com" },
  { rosterNo: 43, name: "SHAH RIYA NAEEM", email: "naeem@w3engineers.com" },
  { rosterNo: 44, name: "MD. ABDULLA AL RIAD", email: "riad@w3engineers.com" },
  { rosterNo: 45, name: "ZASIA ZAFREEN", email: "zasia.zafreen@w3engineers.com" },
  { rosterNo: 46, name: "SYEDA SAMIA SULTANA", email: "samia.sultana@w3engineers.com" },
  { rosterNo: 47, name: "MD ARIFUZZAMAN", email: "arif.qa@w3engineers.com" },
  { rosterNo: 48, name: "IBRAHIM RASHID MAZUMDAR", email: "ibrahim@w3engineers.com" },
  { rosterNo: 49, name: "RUBAYET SHAREEN", email: "rubayet@w3engineers.com" },
  { rosterNo: 50, name: "MD. EMTIYAJ UDDIN EMON", email: "emon@w3engineers.com" },
  { rosterNo: 51, name: "AHMED SHAMIR SHAZID", email: "shazid@w3engineers.com" },
  { rosterNo: 52, name: "NAFIA HOSSAIN", email: "nafia@w3engineers.com" },
  { rosterNo: 53, name: "MD AMINUL ISLAM", email: "aminul@w3engineers.com" },
  { rosterNo: 54, name: "KHAIRUN NAHAR MUNNE", email: "munne@w3engineers.com" },
  { rosterNo: 55, name: "SAMIA SULTANA", email: "samia@w3engineers.com" },
  { rosterNo: 56, name: "MD MUNTASIR JAHID AYAN", email: "muntasir@w3engineers.com" },
  { rosterNo: 57, name: "ABDUL AWAL NADIM", email: "nadim@w3engineers.com" },
  { rosterNo: 58, name: "ZAHID HASAN JUEL", email: "zahid.juel@w3engineers.com" },
  { rosterNo: 59, name: "TARIQUZZAMAN TUHIN", email: "tuhin@w3engineers.com" },
  { rosterNo: 60, name: "ASHIKUR RAHMAN", email: "ashikur@w3engineers.com" },
  { rosterNo: 61, name: "ANTARA PAUL", email: "antara@w3engineers.com" },
  { rosterNo: 62, name: "RAFATUL ISLAM", email: "rafatul@w3engineers.com" },
  { rosterNo: 63, name: "MD. ASHFIQUL ALAM CHOWDHURY", email: "ashfiqul@w3engineers.com" },
  { rosterNo: 64, name: "RAJIB BISWAS", email: "rajib.b@w3engineers.com" },
  { rosterNo: 65, name: "MD. JABER AL SALEH", email: "jaber@w3engineers.com" },
  { rosterNo: 66, name: "FORHAD IBN HAQUE", email: "forhad@w3engineers.com" },
];

type Outcome =
  | { status: "updated"; rosterNo: number; from: string; to: string }
  | { status: "unchanged"; rosterNo: number; email: string }
  | { status: "missing"; rosterNo: number; name: string }
  | { status: "skipped-organizer"; rosterNo: number; email: string }
  | { status: "conflict"; rosterNo: number; email: string; reason: string };

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `=== Update ${ROSTER_EMAILS.length} roster emails${dryRun ? " (dry run)" : ""} ===`,
  );

  const outcomes: Outcome[] = [];

  for (const row of ROSTER_EMAILS) {
    const employeeId = `roster-${row.rosterNo}`;
    const nextEmail = row.email.toLowerCase();

    const [existing] = await db
      .select({
        id: participants.id,
        email: participants.email,
        role: participants.role,
      })
      .from(participants)
      .where(eq(participants.employeeId, employeeId))
      .limit(1);

    if (!existing) {
      outcomes.push({ status: "missing", rosterNo: row.rosterNo, name: row.name });
      continue;
    }

    if (existing.role !== "participant") {
      outcomes.push({
        status: "skipped-organizer",
        rosterNo: row.rosterNo,
        email: existing.email,
      });
      continue;
    }

    if (existing.email.toLowerCase() === nextEmail) {
      outcomes.push({
        status: "unchanged",
        rosterNo: row.rosterNo,
        email: existing.email,
      });
      continue;
    }

    // Watch for email collisions — `participants.email` is UNIQUE.
    const [clash] = await db
      .select({ id: participants.id, employeeId: participants.employeeId })
      .from(participants)
      .where(eq(participants.email, nextEmail))
      .limit(1);

    if (clash && clash.id !== existing.id) {
      outcomes.push({
        status: "conflict",
        rosterNo: row.rosterNo,
        email: nextEmail,
        reason: `already used by ${clash.employeeId ?? clash.id}`,
      });
      continue;
    }

    if (!dryRun) {
      await db
        .update(participants)
        .set({ email: nextEmail })
        .where(eq(participants.id, existing.id));
    }
    outcomes.push({
      status: "updated",
      rosterNo: row.rosterNo,
      from: existing.email,
      to: nextEmail,
    });
  }

  const counts = outcomes.reduce<Record<Outcome["status"], number>>(
    (acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    },
    {
      updated: 0,
      unchanged: 0,
      missing: 0,
      "skipped-organizer": 0,
      conflict: 0,
    },
  );

  for (const o of outcomes) {
    switch (o.status) {
      case "updated":
        console.log(`[${o.rosterNo}] ${o.from} → ${o.to}`);
        break;
      case "unchanged":
        console.log(`[${o.rosterNo}] unchanged (${o.email})`);
        break;
      case "missing":
        console.warn(`[${o.rosterNo}] MISSING participant (${o.name})`);
        break;
      case "skipped-organizer":
        console.warn(`[${o.rosterNo}] skipped — organizer row (${o.email})`);
        break;
      case "conflict":
        console.error(
          `[${o.rosterNo}] CONFLICT — cannot set ${o.email}: ${o.reason}`,
        );
        break;
    }
  }

  console.log("---");
  console.log(
    `updated=${counts.updated} unchanged=${counts.unchanged} missing=${counts.missing} skipped-organizer=${counts["skipped-organizer"]} conflict=${counts.conflict}`,
  );

  if (counts.conflict > 0) {
    process.exit(2);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
