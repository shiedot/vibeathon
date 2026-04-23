/**
 * Apply the live hackathon results to the bracket.
 *
 * - Seeds pods + R1 battles using the fixed R1 pairings.
 * - Resolves every R1 battle with Team A as the winner.
 * - Rebuilds R2 in the exact order specified, then resolves each with the
 *   organizer-declared winner.
 * - Rebuilds R3 in the exact order specified, leaving the battles pending.
 *
 * Safe to re-run: starts by calling resetTournamentState() which wipes all
 * teams / battles / ledger without touching the participant roster.
 *
 * Usage:
 *   pnpm tsx scripts/apply-current-results.ts
 */
import "dotenv/config";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  battles,
  participants,
  roundConfig,
  teamMembers,
  teams,
  type Battle,
} from "../src/db/schema";
import { resolveWithWinner } from "../src/server/battles";
import { commitPodsAndR1, resetTournamentState } from "../src/server/pods";
import { ROUND_DEFS, bettingClosesAt } from "../src/lib/time";

type Pair = readonly [string, string];

const ORGANIZER_USER_ID = "admin:apply-current-results";

// ---------------------------------------------------------------------------
// R1 pairings. Team A on the left, Team B on the right. Winners of R1 are
// ALL on the left (per the user's statement).
// ---------------------------------------------------------------------------
const R1_PAIRS: readonly Pair[] = [
  ["FAZLEY RABBI BISWAS", "MD. ASHFIQUL ALAM CHOWDHURY"],
  ["MOHAMMAD NABILUZZAMAN NELOY", "MD. TAHSEEN RAHMAN"],
  ["SOHAG SAGAR", "MD. AL AMIN"],
  ["MAHIBUR RAHMAN", "SURID TAHSAN MUNIR"],

  ["MD. SHAHIDUZZAMAN", "IMTIAZ AHAMED SHAWN"],
  ["MD. ABDULLA AL RIAD", "MD. ARIFUL ISLAM"],
  ["SHOHEL RANA", "SAMIA SULTANA"],
  ["MD SAIFUL ISLAM", "SUMAIYA SIDDIQUA MUMU"],

  ["MD ABO BASHAR BAPPI", "RUBAYET SHAREEN"],
  ["MD. ARIFUR RAHIM", "ZAHID HASAN JUEL"],
  ["SAMRAT GHOSH", "MD. EMTIYAJ UDDIN EMON"],
  ["MD. ABDULLAH AL MUBIN", "RAJIB BISWAS"],

  ["SYED MAHBOOB NUR", "TARIQUZZAMAN TUHIN"],
  ["JANNATUL NAIM", "AHMED SHAMIR SHAZID"],
  ["ABDUL AWAL NADIM", "KHANDAKAR ANIM HASSAN ADNAN"],
  ["MD. MASHRUF EHSAN", "NAFIA HOSSAIN"],

  ["MAMUNUR RASHID", "SYEDA SAMIA SULTANA"],
  ["ANTARA PAUL", "S.M MAMUNUR RAHAMAN HERA"],
  ["PARTHA NATH", "ASHIKUR RAHMAN"],
  ["MST. TUNAJJINA ISLAM SHEJUTY", "MEHEDI HASAN"],

  ["MUHAMMAD IQBAL HOSSAIN", "SHAH RIYA NAEEM"],
  ["MD MAMUN HASAN", "MD. JABER AL SALEH"],
  ["MD. SHOHAG RANA", "SALAH UDDIB"],
  ["KHAIRUN NAHAR MUNNE", "MD RAJIB"],

  ["JAMINUR RASHID", "FAZLE RABBI"],
  ["ZASIA ZAFREEN", "MD. ASRAFUL ISLAM"],
  ["IBRAHIM RASHID MAZUMDAR", "MD TOHIDUL ISLAM"],
  ["MD ARIFUZZAMAN", "SYED MURSHID ALAM"],

  ["MD. TAWHIDUR RAHMAN", "MD. AMINUL ISLAM"],
  ["MUHAMMAD TAHSIN AMIN", "MD. TARIQUL ISLAM"],
  ["RAFATUL ISLAM", "LUSCIOUS LARRY DAS"],
  ["MD MUNTASIR JAHID AYAN", "MAHMUDUL HASAN MASUM"],
] as const;

// ---------------------------------------------------------------------------
// R2 — [teamA captain, teamB captain, winner captain]
// ---------------------------------------------------------------------------
const R2_PAIRS: readonly (readonly [string, string, string])[] = [
  ["FAZLEY RABBI BISWAS", "MOHAMMAD NABILUZZAMAN NELOY", "MOHAMMAD NABILUZZAMAN NELOY"],
  ["SOHAG SAGAR", "MAHIBUR RAHMAN", "MAHIBUR RAHMAN"],

  ["MD. SHAHIDUZZAMAN", "MD. ABDULLA AL RIAD", "MD. ABDULLA AL RIAD"],
  ["SHOHEL RANA", "MD SAIFUL ISLAM", "MD SAIFUL ISLAM"],

  ["MD ABO BASHAR BAPPI", "MD. ARIFUR RAHIM", "MD. ARIFUR RAHIM"],
  ["SAMRAT GHOSH", "MD. ABDULLAH AL MUBIN", "SAMRAT GHOSH"],

  ["SYED MAHBOOB NUR", "JANNATUL NAIM", "JANNATUL NAIM"],
  ["ABDUL AWAL NADIM", "MD. MASHRUF EHSAN", "MD. MASHRUF EHSAN"],

  ["MAMUNUR RASHID", "ANTARA PAUL", "MAMUNUR RASHID"],
  ["PARTHA NATH", "MST. TUNAJJINA ISLAM SHEJUTY", "PARTHA NATH"],

  ["MUHAMMAD IQBAL HOSSAIN", "MD MAMUN HASAN", "MD MAMUN HASAN"],
  ["MD. SHOHAG RANA", "KHAIRUN NAHAR MUNNE", "KHAIRUN NAHAR MUNNE"],

  ["JAMINUR RASHID", "ZASIA ZAFREEN", "JAMINUR RASHID"],
  ["IBRAHIM RASHID MAZUMDAR", "MD ARIFUZZAMAN", "IBRAHIM RASHID MAZUMDAR"],

  ["MD. TAWHIDUR RAHMAN", "MUHAMMAD TAHSIN AMIN", "MUHAMMAD TAHSIN AMIN"],
  ["RAFATUL ISLAM", "MD MUNTASIR JAHID AYAN", "RAFATUL ISLAM"],
] as const;

// ---------------------------------------------------------------------------
// R3 — [teamA captain, teamB captain], pending (no winner yet).
// ---------------------------------------------------------------------------
const R3_PAIRS: readonly Pair[] = [
  ["MOHAMMAD NABILUZZAMAN NELOY", "MAHIBUR RAHMAN"],
  ["MD. ABDULLA AL RIAD", "MD SAIFUL ISLAM"],
  ["MD. ARIFUR RAHIM", "SAMRAT GHOSH"],
  ["JANNATUL NAIM", "MD. MASHRUF EHSAN"],
  ["MAMUNUR RASHID", "PARTHA NATH"],
  ["MD MAMUN HASAN", "KHAIRUN NAHAR MUNNE"],
  ["JAMINUR RASHID", "IBRAHIM RASHID MAZUMDAR"],
  ["MUHAMMAD TAHSIN AMIN", "RAFATUL ISLAM"],
] as const;

// Hand-curated aliases for names that don't match the roster verbatim.
const NAME_ALIASES: Record<string, string> = {
  "SALAH UDDIB": "SALAH UDDIN", // typo in user's input
  "MD. ASRAFUL ISLAM": "BAIG ASRAFUL ISLAM", // roster uses the BAIG prefix
};

function normalize(name: string): string {
  return name
    .toUpperCase()
    .replace(/\./g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveRosterIds(): Promise<Map<string, string>> {
  const ps = await db
    .select({ id: participants.id, name: participants.name, role: participants.role })
    .from(participants);

  const byNorm = new Map<string, { id: string; name: string }>();
  for (const p of ps) {
    if (p.role !== "participant") continue;
    byNorm.set(normalize(p.name), { id: p.id, name: p.name });
  }

  const out = new Map<string, string>();

  const pushName = (raw: string) => {
    if (out.has(raw)) return;
    const alias = NAME_ALIASES[raw] ?? raw;
    const hit = byNorm.get(normalize(alias));
    if (!hit) {
      throw new Error(
        `Could not match name "${raw}" (normalized "${normalize(alias)}") to any eligible participant.`,
      );
    }
    out.set(raw, hit.id);
  };

  for (const [a, b] of R1_PAIRS) {
    pushName(a);
    pushName(b);
  }
  // R2/R3 names are all carried forward from R1, but double-check:
  for (const [a, b, w] of R2_PAIRS) {
    pushName(a);
    pushName(b);
    pushName(w);
  }
  for (const [a, b] of R3_PAIRS) {
    pushName(a);
    pushName(b);
  }

  return out;
}

async function findBattleByCaptains(
  roundNumber: number,
  captainAId: string,
  captainBId: string,
): Promise<{ battle: Battle; teamAId: string; teamBId: string } | null> {
  const roundBattles = await db
    .select()
    .from(battles)
    .where(eq(battles.roundNumber, roundNumber));
  const teamIds = new Set<string>();
  for (const b of roundBattles) {
    teamIds.add(b.teamAId);
    teamIds.add(b.teamBId);
  }
  if (teamIds.size === 0) return null;

  const tRows = await db
    .select({ id: teams.id, captainId: teams.captainId })
    .from(teams);
  const captainByTeam = new Map(tRows.map((t) => [t.id, t.captainId]));

  for (const b of roundBattles) {
    const capA = captainByTeam.get(b.teamAId);
    const capB = captainByTeam.get(b.teamBId);
    const pair = new Set([capA, capB]);
    if (pair.has(captainAId) && pair.has(captainBId)) {
      return { battle: b, teamAId: b.teamAId, teamBId: b.teamBId };
    }
  }
  return null;
}

async function currentTeamIdForParticipant(
  participantId: string,
): Promise<string> {
  const [row] = await db
    .select({ currentTeamId: participants.currentTeamId })
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1);
  if (!row?.currentTeamId) {
    throw new Error(`Participant ${participantId} has no current team`);
  }
  return row.currentTeamId;
}

async function rebuildRound(opts: {
  round: 2 | 3;
  pairs: readonly Pair[];
  nameToId: Map<string, string>;
}): Promise<{ battleIds: string[] }> {
  // Purge any battles currently sitting at this round (auto-advance may have
  // generated them; we replace with the exact order the organizer specified).
  await db.delete(battles).where(eq(battles.roundNumber, opts.round));

  const duration = ROUND_DEFS[opts.round].durationMinutes;
  const scheduled = new Date(Date.now() + 10 * 60 * 1000);

  const battleIds: string[] = [];
  for (const [a, b] of opts.pairs) {
    const capAId = opts.nameToId.get(a);
    const capBId = opts.nameToId.get(b);
    if (!capAId || !capBId) {
      throw new Error(`Unresolved captain name: ${a} or ${b}`);
    }
    const teamAId = await currentTeamIdForParticipant(capAId);
    const teamBId = await currentTeamIdForParticipant(capBId);
    if (teamAId === teamBId) {
      throw new Error(
        `R${opts.round} matchup ${a} vs ${b} resolves to the same team ${teamAId}; a prior round likely didn't resolve as expected.`,
      );
    }

    const [inserted] = await db
      .insert(battles)
      .values({
        roundNumber: opts.round,
        isPlayIn: false,
        teamAId,
        teamBId,
        scheduledStart: scheduled,
        roundDurationMinutes: duration,
        bettingClosesAt: bettingClosesAt(scheduled, duration),
        status: "pending",
      })
      .returning({ id: battles.id });
    battleIds.push(inserted.id);
  }

  await db
    .insert(roundConfig)
    .values({
      roundNumber: opts.round,
      label: ROUND_DEFS[opts.round].label,
      startsAt: scheduled,
      endsAt: new Date(scheduled.getTime() + duration * 60 * 1000),
      durationMinutes: duration,
      teamSize: ROUND_DEFS[opts.round].teamSize,
      isPod: ROUND_DEFS[opts.round].isPod,
    })
    .onConflictDoUpdate({
      target: roundConfig.roundNumber,
      set: {
        startsAt: scheduled,
        endsAt: new Date(scheduled.getTime() + duration * 60 * 1000),
        durationMinutes: duration,
        label: ROUND_DEFS[opts.round].label,
      },
    });

  return { battleIds };
}

async function main(): Promise<void> {
  console.log("=== apply-current-results ===");

  if (R1_PAIRS.length !== 32) {
    throw new Error(`Expected 32 R1 pairs, got ${R1_PAIRS.length}`);
  }
  if (R2_PAIRS.length !== 16) {
    throw new Error(`Expected 16 R2 pairs, got ${R2_PAIRS.length}`);
  }
  if (R3_PAIRS.length !== 8) {
    throw new Error(`Expected 8 R3 pairs, got ${R3_PAIRS.length}`);
  }

  const nameToId = await resolveRosterIds();
  console.log(`Resolved ${nameToId.size} unique names.`);

  console.log("Wiping existing tournament state...");
  await resetTournamentState();

  // --- R1 ------------------------------------------------------------------
  console.log("Seeding pods + R1 battles...");
  const r1Matchups = R1_PAIRS.map((pair, i) => {
    const podId = Math.floor(i / 4) + 1; // 4 battles per pod → 8 pods
    return {
      podId,
      teamAParticipantId: nameToId.get(pair[0])!,
      teamBParticipantId: nameToId.get(pair[1])!,
    };
  });
  const scheduledR1 = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
  const r1Commit = await commitPodsAndR1({
    matchups: r1Matchups,
    scheduledStart: scheduledR1,
    byUserId: ORGANIZER_USER_ID,
  });
  console.log(
    `R1 seeded: ${r1Commit.teamsCreated} teams, ${r1Commit.battlesCreated} battles.`,
  );

  console.log("Resolving R1 — Team A wins every matchup...");
  const r1Battles = await db
    .select()
    .from(battles)
    .where(eq(battles.roundNumber, 1))
    .orderBy(asc(battles.createdAt));

  // Pre-compute which battle row corresponds to which pair so we resolve with
  // the correct "Team A" side regardless of insertion order.
  const captainByTeam = new Map<string, string>();
  for (const t of await db
    .select({ id: teams.id, captainId: teams.captainId })
    .from(teams)) {
    captainByTeam.set(t.id, t.captainId);
  }
  const idsToNames = new Map<string, string>();
  for (const [name, id] of nameToId.entries()) idsToNames.set(id, name);
  const teamAIdByNamePair = new Map<string, string>();
  for (const pair of R1_PAIRS) {
    const idA = nameToId.get(pair[0])!;
    teamAIdByNamePair.set(`${pair[0]}|${pair[1]}`, idA);
  }

  for (const b of r1Battles) {
    const capA = captainByTeam.get(b.teamAId)!;
    const capB = captainByTeam.get(b.teamBId)!;
    const nameA = idsToNames.get(capA)!;
    const nameB = idsToNames.get(capB)!;
    // Winner is the user's "Team A" — look up which of {nameA, nameB} was the
    // left-hand entry in R1_PAIRS.
    const userPair = R1_PAIRS.find(
      (p) =>
        (p[0] === nameA && p[1] === nameB) ||
        (p[0] === nameB && p[1] === nameA),
    );
    if (!userPair) throw new Error(`Unknown R1 pair: ${nameA} vs ${nameB}`);
    const winnerCaptainId = nameToId.get(userPair[0])!;
    const winnerTeamId =
      capA === winnerCaptainId ? b.teamAId : b.teamBId;
    await resolveWithWinner(b, winnerTeamId, null, {
      byUserId: ORGANIZER_USER_ID,
    });
  }
  console.log(`Resolved ${r1Battles.length} R1 battles.`);

  // --- R2 ------------------------------------------------------------------
  console.log("Rebuilding R2 matchups in organizer-specified order...");
  await rebuildRound({
    round: 2,
    pairs: R2_PAIRS.map(([a, b]) => [a, b] as const),
    nameToId,
  });

  const r2Battles = await db
    .select()
    .from(battles)
    .where(eq(battles.roundNumber, 2))
    .orderBy(asc(battles.createdAt));
  console.log(`Resolving ${r2Battles.length} R2 battles with organizer picks...`);

  // Refresh captain map — R2 teams are the same winner teams from R1.
  const captainByTeamR2 = new Map<string, string>();
  for (const t of await db
    .select({ id: teams.id, captainId: teams.captainId })
    .from(teams)) {
    captainByTeamR2.set(t.id, t.captainId);
  }

  for (let i = 0; i < r2Battles.length; i += 1) {
    const b = r2Battles[i];
    const [capAName, capBName, winnerName] = R2_PAIRS[i];
    const winnerCaptainId = nameToId.get(winnerName)!;
    const capA = captainByTeamR2.get(b.teamAId)!;
    const capB = captainByTeamR2.get(b.teamBId)!;
    if (capA !== nameToId.get(capAName) || capB !== nameToId.get(capBName)) {
      throw new Error(
        `R2 battle ${i + 1} captains do not match expected ${capAName} vs ${capBName}`,
      );
    }
    const winnerTeamId = capA === winnerCaptainId ? b.teamAId : b.teamBId;
    await resolveWithWinner(b, winnerTeamId, null, {
      byUserId: ORGANIZER_USER_ID,
    });
  }
  console.log("R2 resolved.");

  // --- R3 ------------------------------------------------------------------
  console.log("Rebuilding R3 matchups in organizer-specified order...");
  await rebuildRound({
    round: 3,
    pairs: R3_PAIRS,
    nameToId,
  });

  const r3Battles = await db
    .select()
    .from(battles)
    .where(eq(battles.roundNumber, 3))
    .orderBy(asc(battles.createdAt));
  console.log(`R3 has ${r3Battles.length} pending battles (no winners yet).`);

  // --- Summary -------------------------------------------------------------
  console.log("\n=== Summary ===");
  const final = await db
    .select()
    .from(battles)
    .orderBy(asc(battles.roundNumber), asc(battles.createdAt));
  const byRound = new Map<number, typeof final>();
  for (const b of final) {
    const arr = byRound.get(b.roundNumber) ?? [];
    arr.push(b);
    byRound.set(b.roundNumber, arr);
  }
  const allTeams = await db.select().from(teams);
  const allParts = await db.select().from(participants);
  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const partById = new Map(allParts.map((p) => [p.id, p]));
  const members = await db
    .select()
    .from(teamMembers)
    .where(isNull(teamMembers.leftAt));
  const membersByTeam = new Map<string, string[]>();
  for (const m of members) {
    const arr = membersByTeam.get(m.teamId) ?? [];
    arr.push(m.participantId);
    membersByTeam.set(m.teamId, arr);
  }
  const labelTeam = (id: string): string => {
    const t = teamById.get(id);
    if (!t) return id.slice(0, 8);
    const cap = partById.get(t.captainId)?.name ?? "?";
    const n = (membersByTeam.get(id) ?? []).length;
    return `${cap} (${n}m, pot ₿${t.teamPot})`;
  };
  for (const [r, arr] of [...byRound.entries()].sort(([a], [b]) => a - b)) {
    console.log(`\nRound ${r}: ${arr.length} battles`);
    arr.forEach((b, i) => {
      const winner = b.winnerTeamId ? labelTeam(b.winnerTeamId) : "—";
      console.log(
        `  ${i + 1}. [${b.status}] ${labelTeam(b.teamAId)}  vs  ${labelTeam(b.teamBId)}  →  ${winner}`,
      );
    });
  }

  void and;
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
