import Papa from "papaparse";
import { z } from "zod";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { sql } from "drizzle-orm";

const NullableBool = z
  .string()
  .optional()
  .transform((v) => {
    if (v == null) return false;
    const norm = v.trim().toLowerCase();
    return ["y", "yes", "true", "1"].includes(norm);
  });

const IntStr = (fallback = 0) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return fallback;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : fallback;
    });

const PitchLang = z
  .string()
  .optional()
  .transform((v) => {
    const norm = v?.trim().toLowerCase();
    if (norm === "english" || norm === "bangla" || norm === "either") return norm;
    return "either" as const;
  });

const Payment = z
  .string()
  .optional()
  .transform((v) => {
    const norm = v?.trim().toLowerCase();
    if (norm === "bkash" || norm === "nagad" || norm === "bank") return norm;
    return null;
  });

const CsvRow = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().min(1),
  employee_id: z.string().min(1),
  years_coding: IntStr(0),
  comfort_level: IntStr(1),
  primary_stack: z.string().optional().default(""),
  tool_of_choice: z.string().optional().default(""),
  license_status: z.string().optional().default(""),
  tool_installed_tested: NullableBool,
  completed_test_pr: NullableBool,
  shipping_confidence: IntStr(1),
  preferred_pitch_language: PitchLang,
  payment_method: Payment,
  payment_account: z.string().optional().default(""),
  senior_volunteer_opt_in: NullableBool,
});

export type IngestResult = {
  inserted: number;
  updated: number;
  errors: { row: number; message: string }[];
};

function toLowerKeys(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.trim().toLowerCase().replace(/\s+/g, "_")] = v ?? "";
  }
  return out;
}

/**
 * Parse a CSV string + upsert every valid row into `participants`.
 * Upsert key: `employee_id`. `completed_test_pr` gates participation per §9.
 */
export async function ingestRosterCsv(raw: string): Promise<IngestResult> {
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  const result: IngestResult = { inserted: 0, updated: 0, errors: [] };

  for (let i = 0; i < parsed.data.length; i += 1) {
    const rawRow = toLowerKeys(parsed.data[i] ?? {});
    const check = CsvRow.safeParse(rawRow);
    if (!check.success) {
      result.errors.push({
        row: i + 2, // +1 for header, +1 for 1-based line number
        message: check.error.issues.map((e) => e.message).join("; "),
      });
      continue;
    }

    const row = check.data;
    const setupStatus = row.completed_test_pr ? "ready" : "incomplete";

    const existing = await db
      .select({ id: participants.id })
      .from(participants)
      .where(sql`${participants.employeeId} = ${row.employee_id}`)
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(participants)
        .set({
          name: row.name,
          email: row.email.toLowerCase(),
          department: row.department,
          yearsCoding: row.years_coding,
          comfortLevel: row.comfort_level,
          primaryStack: row.primary_stack,
          toolOfChoice: row.tool_of_choice,
          licenseStatus: row.license_status,
          toolInstalledTested: row.tool_installed_tested,
          completedTestPr: row.completed_test_pr,
          shippingConfidence: row.shipping_confidence,
          preferredPitchLanguage: row.preferred_pitch_language,
          paymentMethod: row.payment_method ?? undefined,
          paymentAccount: row.payment_account,
          setupStatus,
        })
        .where(sql`${participants.id} = ${existing[0].id}`);
      result.updated += 1;
    } else {
      await db.insert(participants).values({
        name: row.name,
        email: row.email.toLowerCase(),
        department: row.department,
        employeeId: row.employee_id,
        yearsCoding: row.years_coding,
        comfortLevel: row.comfort_level,
        primaryStack: row.primary_stack,
        toolOfChoice: row.tool_of_choice,
        licenseStatus: row.license_status,
        toolInstalledTested: row.tool_installed_tested,
        completedTestPr: row.completed_test_pr,
        shippingConfidence: row.shipping_confidence,
        preferredPitchLanguage: row.preferred_pitch_language,
        paymentMethod: row.payment_method ?? undefined,
        paymentAccount: row.payment_account,
        setupStatus,
        personalBankroll: 1000,
      });
      result.inserted += 1;
    }
  }
  return result;
}

export function rosterCsvTemplate(): string {
  return (
    [
      "name",
      "email",
      "department",
      "employee_id",
      "years_coding",
      "comfort_level",
      "primary_stack",
      "tool_of_choice",
      "license_status",
      "tool_installed_tested",
      "completed_test_pr",
      "shipping_confidence",
      "preferred_pitch_language",
      "payment_method",
      "payment_account",
      "senior_volunteer_opt_in",
    ].join(",") +
    "\n" +
    [
      "Alice Example",
      "alice@travelai.com",
      "Engineering",
      "EMP-001",
      "3",
      "3",
      "TypeScript",
      "Cursor",
      "Licensed",
      "Y",
      "Y",
      "4",
      "english",
      "bkash",
      "017XXXXXXXX",
      "N",
    ].join(",") +
    "\n"
  );
}
