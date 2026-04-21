import { and, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bankrollLedger,
  battles,
  bets,
  consensusVotes,
  coachNominations,
  participants,
  teamMembers,
  teams,
} from "@/db/schema";

export const PHANTOM_EMAIL_SUFFIX = "@phantom.vibeathon.local";
export const PHANTOM_EMPLOYEE_ID_PREFIX = "phantom-";

/** Is this a synthetic "Traveller N" row added by the admin to bulk the roster? */
export function isPhantomTraveller(row: {
  email: string;
  employeeId: string;
}): boolean {
  return (
    row.email.endsWith(PHANTOM_EMAIL_SUFFIX) ||
    row.employeeId.startsWith(PHANTOM_EMPLOYEE_ID_PREFIX)
  );
}

async function maxTravellerSuffix(): Promise<number> {
  const rows = await db
    .select({ name: participants.name })
    .from(participants)
    .where(like(participants.name, "Traveller %"));
  let max = 0;
  for (const r of rows) {
    const m = r.name.match(/^Traveller (\d+)$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

async function assertNoTournamentStateYet() {
  const [t] = await db.select({ id: teams.id }).from(teams).limit(1);
  if (t) {
    throw new Error(
      "Teams already exist — reset the tournament before changing the roster.",
    );
  }
  const [b] = await db.select({ id: battles.id }).from(battles).limit(1);
  if (b) {
    throw new Error(
      "Battles already exist — reset the tournament before changing the roster.",
    );
  }
}

export async function addPhantomTraveller(): Promise<{
  id: string;
  name: string;
}> {
  await assertNoTournamentStateYet();

  const next = (await maxTravellerSuffix()) + 1;
  const name = `Traveller ${next}`;
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `traveller-${next}-${suffix}${PHANTOM_EMAIL_SUFFIX}`;
  const employeeId = `${PHANTOM_EMPLOYEE_ID_PREFIX}${next}-${suffix}`;

  // Mild distribution so snake-draft has variety.
  const yearsCoding = (next % 6) + 1;
  const comfortLevel = (next % 4) + 1;
  const department = `Dept ${next % 4}`;

  const [row] = await db
    .insert(participants)
    .values({
      name,
      email,
      department,
      employeeId,
      yearsCoding,
      comfortLevel,
      primaryStack: "",
      toolOfChoice: "",
      licenseStatus: "",
      preferredPitchLanguage: "either",
      setupStatus: "ready",
    })
    .returning({ id: participants.id, name: participants.name });
  return row;
}

export async function addPhantomTravellers(n: number): Promise<number> {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("addPhantomTravellers requires a positive integer");
  }
  let added = 0;
  for (let i = 0; i < n; i += 1) {
    await addPhantomTraveller();
    added += 1;
  }
  return added;
}

/**
 * Remove the phantom traveller with the highest numeric suffix. No-op if no
 * phantoms exist. Throws if tournament state exists.
 */
export async function removeLastPhantomTraveller(): Promise<{
  removedId: string;
  removedName: string;
} | null> {
  await assertNoTournamentStateYet();

  const rows = await db
    .select({
      id: participants.id,
      name: participants.name,
      email: participants.email,
      employeeId: participants.employeeId,
    })
    .from(participants)
    .where(like(participants.name, "Traveller %"))
    .orderBy(desc(participants.name));

  const phantoms = rows
    .filter((r) => isPhantomTraveller(r))
    .map((r) => ({
      id: r.id,
      name: r.name,
      n:
        parseInt(
          /^Traveller (\d+)$/.exec(r.name)?.[1] ?? "0",
          10,
        ) || 0,
    }))
    .sort((a, b) => b.n - a.n);

  if (phantoms.length === 0) return null;

  const target = phantoms[0];
  await hardRemoveParticipant(target.id);
  return { removedId: target.id, removedName: target.name };
}

/**
 * Hard-delete a participant and every row that references them. Refuses if
 * team state exists (use admin overrides + reset to unwind first).
 *
 * Idempotent-ish: safe to call on a fresh DB, throws if already participating.
 */
export async function hardRemoveParticipant(participantId: string): Promise<void> {
  await assertNoTournamentStateYet();

  await db.transaction(async (tx) => {
    // The assert above guarantees teams/battles are empty, so the only
    // dependent rows we might see are bankroll_ledger seed rows (shouldn't
    // exist pre-commit), bets/votes (same), and coach nominations.
    await tx
      .delete(coachNominations)
      .where(
        and(
          eq(coachNominations.nominatorId, participantId),
        ),
      );
    await tx
      .delete(coachNominations)
      .where(eq(coachNominations.nomineeId, participantId));

    await tx
      .delete(bankrollLedger)
      .where(eq(bankrollLedger.participantId, participantId));
    await tx.delete(bets).where(eq(bets.bettorId, participantId));
    await tx
      .delete(consensusVotes)
      .where(eq(consensusVotes.voterId, participantId));

    // teamMembers referencing this participant (shouldn't exist pre-commit,
    // but cheap to clean up for safety).
    await tx
      .delete(teamMembers)
      .where(eq(teamMembers.participantId, participantId));

    await tx.delete(participants).where(eq(participants.id, participantId));
  });
}

export type TravellerRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  employeeId: string;
  role: "participant" | "organizer" | "judge";
  yearsCoding: number;
  comfortLevel: number;
  isPhantom: boolean;
  createdAt: string;
};

export async function listTravellers(): Promise<TravellerRow[]> {
  const rows = await db
    .select({
      id: participants.id,
      name: participants.name,
      email: participants.email,
      department: participants.department,
      employeeId: participants.employeeId,
      role: participants.role,
      yearsCoding: participants.yearsCoding,
      comfortLevel: participants.comfortLevel,
      createdAt: participants.createdAt,
    })
    .from(participants);
  return rows
    .map((r) => ({
      ...r,
      isPhantom: isPhantomTraveller({
        email: r.email,
        employeeId: r.employeeId,
      }),
      createdAt: r.createdAt.toISOString(),
    }))
    .sort((a, b) => {
      const am = /^Traveller (\d+)$/.exec(a.name);
      const bm = /^Traveller (\d+)$/.exec(b.name);
      if (am && bm) return parseInt(am[1], 10) - parseInt(bm[1], 10);
      if (am) return 1;
      if (bm) return -1;
      return a.name.localeCompare(b.name);
    });
}

// Re-export to satisfy tree-shake sensitive linters.
export const _internals = { isNull, inArray, sql };
