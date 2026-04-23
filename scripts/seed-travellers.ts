/**
 * One-shot roster import for the 66 travellers provided in product briefing.
 *
 * Usage:  pnpm tsx scripts/seed-travellers.ts
 *
 * - Safe to re-run: matches by `employeeId` (the roster #) and upserts.
 * - Refuses if any teams/battles already exist (mirroring admin guardrails).
 * - Does not touch organizer rows (role != "participant").
 *
 * Emails are generated as `first.last@travelai.com` as a placeholder so
 * auth-link-by-email can connect to the real login once people sign up. If a
 * traveller's real email differs, update the participants.email column
 * directly (or re-run this script after editing ROSTER below).
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { battles, participants, teams } from "../src/db/schema";

type Comfort = "Never Before" | "Eager to Learn" | "Using it Regularly" | "Can Teach Others";

const COMFORT_TO_INT: Record<Comfort, 1 | 2 | 3 | 4> = {
  "Never Before": 1,
  "Eager to Learn": 2,
  "Using it Regularly": 3,
  "Can Teach Others": 4,
};

type Row = {
  rosterNo: number;
  name: string;
  department: string;
  team: string;
  years: number;
  comfort: Comfort;
  tool: string;
  confidence: number;
};

const ROSTER: Row[] = [
  { rosterNo: 1, name: "MD. ARIFUR RAHIM", department: "BACKEND", team: "VRS", years: 17, comfort: "Can Teach Others", tool: "Codex + VS Code", confidence: 5 },
  { rosterNo: 2, name: "MD. TAWHIDUR RAHMAN", department: "FRONTEND", team: "PRESTO", years: 15, comfort: "Eager to Learn", tool: "Claude Code + VS Code", confidence: 4 },
  { rosterNo: 3, name: "MD MAMUN HASAN", department: "DATA", team: "VRS", years: 15, comfort: "Eager to Learn", tool: "Claude Code + Antigravity", confidence: 4 },
  { rosterNo: 4, name: "SYED MAHBOOB NUR", department: "AUTOMATION", team: "VRS", years: 13, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 5, name: "S.M MAMUNUR RAHAMAN HERA", department: "BACKEND", team: "PRESTO", years: 13, comfort: "Can Teach Others", tool: "Cursor", confidence: 4 },
  { rosterNo: 6, name: "LUSCIOUS LARRY DAS", department: "BACKEND", team: "VRS", years: 13, comfort: "Eager to Learn", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 7, name: "SYED MURSHID ALAM", department: "FRONTEND", team: "PRESTO", years: 13, comfort: "Eager to Learn", tool: "Codex + VS Code", confidence: 3 },
  { rosterNo: 8, name: "MAHMUDUL HASAN MASUM", department: "SQA", team: "VRS", years: 9, comfort: "Using it Regularly", tool: "Windsurf", confidence: 4 },
  { rosterNo: 9, name: "MD. ABDULLAH AL MUBIN", department: "FRONTEND", team: "PRESTO", years: 8, comfort: "Can Teach Others", tool: "Codex + VS Code and antigravity (google)", confidence: 5 },
  { rosterNo: 10, name: "MD TOHIDUL ISLAM", department: "BACKEND", team: "VRS", years: 7, comfort: "Using it Regularly", tool: "Cursor", confidence: 5 },
  { rosterNo: 11, name: "MUHAMMAD IQBAL HOSSAIN", department: "DATA", team: "VRS", years: 7, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 4 },
  { rosterNo: 12, name: "SHOHEL RANA", department: "FRONTEND", team: "PRESTO", years: 6, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 5 },
  { rosterNo: 13, name: "MAMUNUR RASHID", department: "FRONTEND", team: "PRESTO", years: 6, comfort: "Using it Regularly", tool: "Cursor", confidence: 5 },
  { rosterNo: 14, name: "FAZLEY RABBI BISWAS", department: "BACKEND", team: "PRESTO", years: 6, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 15, name: "PARTHA NATH", department: "FRONTEND", team: "VRS", years: 5, comfort: "Using it Regularly", tool: "Cursor", confidence: 5 },
  { rosterNo: 16, name: "MD SAIFUL ISLAM", department: "BACKEND", team: "PRESTO", years: 5, comfort: "Using it Regularly", tool: "Cursor", confidence: 4 },
  { rosterNo: 17, name: "MD RAJIB", department: "DATA", team: "VRS", years: 5, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 5 },
  { rosterNo: 18, name: "MD. TARIQUL ISLAM", department: "DATA", team: "VRS", years: 5, comfort: "Eager to Learn", tool: "Codex + VS Code", confidence: 3 },
  { rosterNo: 20, name: "JAMINUR RASHID", department: "BACKEND", team: "PRESTO", years: 4.6, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 21, name: "JANNATUL NAIM", department: "BACKEND", team: "VRS", years: 4.5, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 22, name: "SAMRAT GHOSH", department: "BACKEND", team: "VRS", years: 4.5, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 23, name: "IMTIAZ AHAMED SHAWN", department: "FRONTEND", team: "PRESTO", years: 4, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 4 },
  { rosterNo: 24, name: "MD ABO BASHAR BAPPI", department: "BACKEND", team: "VRS", years: 4, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 4 },
  { rosterNo: 25, name: "MD. ARIFUL ISLAM", department: "FRONTEND", team: "VRS", years: 4, comfort: "Eager to Learn", tool: "Cursor", confidence: 4 },
  { rosterNo: 26, name: "MST. TUNAJJINA ISLAM SHEJUTY", department: "DATA", team: "VRS", years: 4, comfort: "Using it Regularly", tool: "Windsurf + Claude Code", confidence: 4 },
  { rosterNo: 27, name: "KHANDAKAR ANIM HASSAN ADNAN", department: "BACKEND", team: "PRESTO", years: 4, comfort: "Using it Regularly", tool: "Cursor", confidence: 4 },
  { rosterNo: 28, name: "SALAH UDDIN", department: "BACKEND", team: "PRESTO", years: 4, comfort: "Using it Regularly", tool: "Cursor", confidence: 4 },
  { rosterNo: 29, name: "BAIG ASRAFUL ISLAM", department: "BACKEND", team: "VRS", years: 4, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 5 },
  { rosterNo: 30, name: "MAHIBUR RAHMAN", department: "FRONTEND", team: "PRESTO", years: 4, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 5 },
  { rosterNo: 31, name: "MUHAMMAD TAHSIN AMIN", department: "FRONTEND", team: "PRESTO", years: 4, comfort: "Using it Regularly", tool: "Cursor", confidence: 4 },
  { rosterNo: 32, name: "MD. AL AMIN", department: "BACKEND", team: "VRS", years: 4, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 5 },
  { rosterNo: 33, name: "MEHEDI HASAN", department: "BACKEND", team: "VRS", years: 3.6, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 34, name: "MD. SHOHAG RANA", department: "AUTOMATION", team: "VRS", years: 3.5, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 35, name: "MD. MASHRUF EHSAN", department: "FRONTEND", team: "VRS", years: 3, comfort: "Using it Regularly", tool: "Cursor", confidence: 5 },
  { rosterNo: 36, name: "MD. TAHSEEN RAHMAN", department: "BACKEND", team: "VRS", years: 3, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 5 },
  { rosterNo: 37, name: "MOHAMMAD NABILUZZAMAN NELOY", department: "BACKEND", team: "VRS", years: 3, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 4 },
  { rosterNo: 38, name: "FAZLE RABBI", department: "BACKEND", team: "VRS", years: 3, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 3 },
  { rosterNo: 39, name: "SOHAG SAGAR", department: "AUTOMATION", team: "VRS", years: 3, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 3 },
  { rosterNo: 40, name: "MD. SHAHIDUZZAMAN", department: "SQA", team: "VRS", years: 3, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 3 },
  { rosterNo: 41, name: "SUMAIYA SIDDIQUA MUMU", department: "FRONTEND", team: "VRS", years: 2.5, comfort: "Using it Regularly", tool: "Cursor", confidence: 4 },
  { rosterNo: 42, name: "SURID TAHSAN MUNIR", department: "DEVOPS", team: "VRS", years: 2, comfort: "Eager to Learn", tool: "Claude Code + VS Code", confidence: 5 },
  { rosterNo: 43, name: "SHAH RIYA NAEEM", department: "DATA", team: "VRS", years: 2, comfort: "Eager to Learn", tool: "Claude Code + VS Code", confidence: 4 },
  { rosterNo: 44, name: "MD. ABDULLA AL RIAD", department: "DATA", team: "VRS", years: 2, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 5 },
  { rosterNo: 45, name: "ZASIA ZAFREEN", department: "BACKEND", team: "PRESTO", years: 2, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 4 },
  { rosterNo: 46, name: "SYEDA SAMIA SULTANA", department: "FRONTEND", team: "PRESTO", years: 2, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 3 },
  { rosterNo: 47, name: "MD ARIFUZZAMAN", department: "SQA", team: "PRESTO", years: 2, comfort: "Never Before", tool: "Codex + VS Code", confidence: 3 },
  { rosterNo: 48, name: "IBRAHIM RASHID MAZUMDAR", department: "SQA", team: "VRS", years: 2, comfort: "Eager to Learn", tool: "Codex + VS Code", confidence: 3 },
  { rosterNo: 49, name: "RUBAYET SHAREEN", department: "DATA", team: "VRS", years: 2, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 5 },
  { rosterNo: 50, name: "MD. EMTIYAJ UDDIN EMON", department: "DATA", team: "VRS", years: 2, comfort: "Using it Regularly", tool: "Cursor", confidence: 5 },
  { rosterNo: 51, name: "AHMED SHAMIR SHAZID", department: "BACKEND", team: "PRESTO", years: 2, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 4 },
  { rosterNo: 52, name: "NAFIA HOSSAIN", department: "DATA", team: "VRS", years: 2, comfort: "Using it Regularly", tool: "Claude Code + VS Code", confidence: 5 },
  { rosterNo: 53, name: "MD AMINUL ISLAM", department: "SQA", team: "PRESTO", years: 1.5, comfort: "Eager to Learn", tool: "Claude Code + VS Code", confidence: 2 },
  { rosterNo: 54, name: "KHAIRUN NAHAR MUNNE", department: "FRONTEND", team: "VRS", years: 1.5, comfort: "Using it Regularly", tool: "Cursor", confidence: 4 },
  { rosterNo: 55, name: "SAMIA SULTANA", department: "BACKEND", team: "PRESTO", years: 1.5, comfort: "Using it Regularly", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 56, name: "MD MUNTASIR JAHID AYAN", department: "BACKEND", team: "VRS", years: 1.5, comfort: "Eager to Learn", tool: "Cursor", confidence: 4 },
  { rosterNo: 57, name: "ABDUL AWAL NADIM", department: "FRONTEND", team: "VRS", years: 1.5, comfort: "Using it Regularly", tool: "Cursor", confidence: 5 },
  { rosterNo: 58, name: "ZAHID HASAN JUEL", department: "SQA", team: "PRESTO", years: 1, comfort: "Never Before", tool: "ChatGPT", confidence: 1 },
  { rosterNo: 59, name: "TARIQUZZAMAN TUHIN", department: "SQA", team: "VRS", years: 1, comfort: "Eager to Learn", tool: "Cursor", confidence: 3 },
  { rosterNo: 60, name: "ASHIKUR RAHMAN", department: "DEVOPS", team: "VRS", years: 1, comfort: "Eager to Learn", tool: "Codex + VS Code", confidence: 5 },
  { rosterNo: 61, name: "ANTARA PAUL", department: "SQA", team: "VRS", years: 1, comfort: "Eager to Learn", tool: "Claude Code + VS Code", confidence: 2 },
  { rosterNo: 62, name: "RAFATUL ISLAM", department: "SQA", team: "VRS", years: 1, comfort: "Eager to Learn", tool: "Claude Code + VS Code", confidence: 3 },
  { rosterNo: 63, name: "MD. ASHFIQUL ALAM CHOWDHURY", department: "BACKEND", team: "VRS", years: 1, comfort: "Eager to Learn", tool: "Claude Code + VS Code", confidence: 5 },
  { rosterNo: 64, name: "RAJIB BISWAS", department: "DEVOPS", team: "VRS", years: 1, comfort: "Eager to Learn", tool: "Codex + VS Code", confidence: 4 },
  { rosterNo: 65, name: "MD. JABER AL SALEH", department: "SQA", team: "VRS", years: 0, comfort: "Eager to Learn", tool: "Claude Code + VS Code", confidence: 3 },
];

const EMAIL_DOMAIN = process.env.ROSTER_EMAIL_DOMAIN ?? "travelai.com";

// Real w3engineers addresses keyed by rosterNo. Takes precedence over the
// generated placeholder email. Keep in sync with
// `scripts/update-roster-emails.ts`.
const EMAIL_BY_ROSTER: Record<number, string> = {
  1: "arif@w3engineers.com",
  2: "tawhid@w3engineers.com",
  3: "mamunhasan@w3engineers.com",
  4: "nur@w3engineers.com",
  5: "hera@w3engineers.com",
  6: "larry@w3engineers.com",
  7: "murshid@w3engineers.com",
  8: "masum@w3engineers.com",
  9: "almubin@w3engineers.com",
  10: "tohidul@w3engineers.com",
  11: "iqbalhossain@w3engineers.com",
  12: "shohel@w3engineers.com",
  13: "mamunur.rashid@w3engineers.com",
  14: "fazley@w3engineers.com",
  15: "partha@w3engineers.com",
  16: "saiful.islam@w3engineers.com",
  17: "md.rajib@w3engineers.com",
  18: "tariqul.islam@w3engineers.com",
  20: "jaminur@w3engineers.com",
  21: "jannatul@w3engineers.com",
  22: "samrat@w3engineers.com",
  23: "imtiaz@w3engineers.com",
  24: "bashar@w3engineers.com",
  25: "ariful@w3engineers.com",
  26: "shejuty@w3engineers.com",
  27: "khandakar.adnan@w3engineers.com",
  28: "salah@w3engineers.com",
  29: "asraful@w3engineers.com",
  30: "mahibur@w3engineers.com",
  31: "tahsin@w3engineers.com",
  32: "al_amin@w3engineers.com",
  33: "mehedi.hasan@w3engineers.com",
  34: "shohag@w3engineers.com",
  35: "ehsan@w3engineers.com",
  36: "tahseen@w3engineers.com",
  37: "neloy@w3engineers.com",
  38: "fazle.rabbi@w3engineers.com",
  39: "sagar@w3engineers.com",
  40: "shahiduzzaman@w3engineers.com",
  41: "mumu@w3engineers.com",
  42: "munir@w3engineers.com",
  43: "naeem@w3engineers.com",
  44: "riad@w3engineers.com",
  45: "zasia.zafreen@w3engineers.com",
  46: "samia.sultana@w3engineers.com",
  47: "arif.qa@w3engineers.com",
  48: "ibrahim@w3engineers.com",
  49: "rubayet@w3engineers.com",
  50: "emon@w3engineers.com",
  51: "shazid@w3engineers.com",
  52: "nafia@w3engineers.com",
  53: "aminul@w3engineers.com",
  54: "munne@w3engineers.com",
  55: "samia@w3engineers.com",
  56: "muntasir@w3engineers.com",
  57: "nadim@w3engineers.com",
  58: "zahid.juel@w3engineers.com",
  59: "tuhin@w3engineers.com",
  60: "ashikur@w3engineers.com",
  61: "antara@w3engineers.com",
  62: "rafatul@w3engineers.com",
  63: "ashfiqul@w3engineers.com",
  64: "rajib.b@w3engineers.com",
  65: "jaber@w3engineers.com",
};

function makeEmail(name: string, rosterNo: number): string {
  const real = EMAIL_BY_ROSTER[rosterNo];
  if (real) return real.toLowerCase();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
  return `${slug}+${rosterNo}@${EMAIL_DOMAIN}`;
}

async function main() {
  console.log(`=== Seed ${ROSTER.length} travellers ===`);

  const [existingTeam] = await db.select({ id: teams.id }).from(teams).limit(1);
  if (existingTeam) {
    throw new Error(
      "Teams already exist. Reset the tournament in /admin/pods first.",
    );
  }
  const [existingBattle] = await db
    .select({ id: battles.id })
    .from(battles)
    .limit(1);
  if (existingBattle) {
    throw new Error(
      "Battles already exist. Reset the tournament in /admin/pods first.",
    );
  }

  let created = 0;
  let updated = 0;

  for (const row of ROSTER) {
    const employeeId = `roster-${row.rosterNo}`;
    const email = makeEmail(row.name, row.rosterNo);
    const comfortLevel = COMFORT_TO_INT[row.comfort];
    const values = {
      name: row.name,
      email,
      department: row.department,
      employeeId,
      role: "participant" as const,
      yearsCoding: Math.floor(row.years),
      comfortLevel,
      shippingConfidence: row.confidence,
      toolOfChoice: row.tool,
      licenseStatus: "active",
      toolInstalledTested: true,
      completedTestPr: true,
      preferredPitchLanguage: "either" as const,
      setupStatus: "ready" as const,
      personalBankroll: 1000,
    };

    const [existing] = await db
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.employeeId, employeeId))
      .limit(1);

    if (existing) {
      await db
        .update(participants)
        .set(values)
        .where(eq(participants.id, existing.id));
      updated += 1;
    } else {
      await db.insert(participants).values(values);
      created += 1;
    }
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);
  console.log(
    "Heads-up: emails are placeholders (name+rosterNo@" +
      EMAIL_DOMAIN +
      "). When users sign up with their real address, their participant row is auto-linked by email — so either update participants.email to match before they sign up, or a new row gets created on first login.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
