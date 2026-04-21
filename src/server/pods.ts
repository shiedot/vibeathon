import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bankrollLedger,
  battles,
  participants,
  roundConfig,
  teamMembers,
  teams,
} from "@/db/schema";
import {
  experienceScore,
  generateR1Matchups,
  snakeDraftPods,
  type RosterEntry,
} from "@/lib/seeding";
import { ROUND_DEFS, bettingClosesAt } from "@/lib/time";

export type PodsPreview = {
  pods: {
    podId: number;
    members: {
      id: string;
      name: string;
      department: string;
      experienceScore: number;
    }[];
  }[];
  r1Matchups: {
    podId: number;
    teamA: { id: string; name: string };
    teamB: { id: string; name: string };
  }[];
};

async function loadReadyRoster(): Promise<RosterEntry[]> {
  const rows = await db
    .select({
      id: participants.id,
      name: participants.name,
      department: participants.department,
      preferredPitchLanguage: participants.preferredPitchLanguage,
      yearsCoding: participants.yearsCoding,
      comfortLevel: participants.comfortLevel,
      role: participants.role,
      isPlayInParticipant: participants.isPlayInParticipant,
      playInResult: participants.playInResult,
    })
    .from(participants);
  return rows
    .filter(
      (r) =>
        r.role === "participant" &&
        !(r.isPlayInParticipant && r.playInResult === "lost"),
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      department: r.department,
      preferredPitchLanguage: r.preferredPitchLanguage,
      experienceScore: experienceScore(r.comfortLevel, r.yearsCoding),
    }));
}

export async function previewPods(seed = 1): Promise<PodsPreview> {
  const roster = await loadReadyRoster();
  if (roster.length === 0) {
    return { pods: [], r1Matchups: [] };
  }
  if (roster.length > 64) {
    throw new Error(
      `Roster has ${roster.length} ready participants; run play-in first to cap at 64.`,
    );
  }
  const pods = snakeDraftPods(roster, 8);
  const r1 = generateR1Matchups(pods, seed);
  return {
    pods: pods.map((p) => ({
      podId: p.podId,
      members: p.members.map((m) => ({
        id: m.id,
        name: m.name,
        department: m.department,
        experienceScore: m.experienceScore,
      })),
    })),
    r1Matchups: r1.map((m) => ({
      podId: m.podId,
      teamA: { id: m.teamA.id, name: m.teamA.name },
      teamB: { id: m.teamB.id, name: m.teamB.name },
    })),
  };
}

/**
 * Commit: creates a solo team per participant, a team_members link, an R1
 * battle per pair, plus a `seed` ledger row per participant recording the
 * 1000 ₿ initial stake.
 *
 * Idempotency: refuses to run if any teams/battles already exist.
 */
export async function commitPodsAndR1(opts: {
  seed: number;
  scheduledStart: Date;
  byUserId: string;
}): Promise<{ teamsCreated: number; battlesCreated: number }> {
  const existingBattles = await db
    .select({ id: battles.id })
    .from(battles)
    .limit(1);
  if (existingBattles.length > 0) {
    throw new Error("Battles already exist; reset before re-generating pods.");
  }
  const existingTeams = await db.select({ id: teams.id }).from(teams).limit(1);
  if (existingTeams.length > 0) {
    throw new Error("Teams already exist; reset before re-generating pods.");
  }

  const roster = await loadReadyRoster();
  if (roster.length === 0) {
    throw new Error("No ready participants to seed.");
  }
  const pods = snakeDraftPods(roster, 8);
  const r1 = generateR1Matchups(pods, opts.seed);

  const durationMinutes = ROUND_DEFS[1].durationMinutes;
  const betClose = bettingClosesAt(opts.scheduledStart, durationMinutes);

  let teamsCreated = 0;
  let battlesCreated = 0;

  await db.transaction(async (tx) => {
    // Upsert round_config row.
    await tx
      .insert(roundConfig)
      .values({
        roundNumber: 1,
        label: ROUND_DEFS[1].label,
        startsAt: opts.scheduledStart,
        endsAt: new Date(
          opts.scheduledStart.getTime() + durationMinutes * 60 * 1000,
        ),
        durationMinutes,
        teamSize: ROUND_DEFS[1].teamSize,
        isPod: true,
      })
      .onConflictDoUpdate({
        target: roundConfig.roundNumber,
        set: {
          startsAt: opts.scheduledStart,
          endsAt: new Date(
            opts.scheduledStart.getTime() + durationMinutes * 60 * 1000,
          ),
          durationMinutes,
          label: ROUND_DEFS[1].label,
        },
      });

    const teamIdByParticipant = new Map<string, string>();

    for (const pod of pods) {
      for (const member of pod.members) {
        const [team] = await tx
          .insert(teams)
          .values({
            podId: pod.podId,
            currentRound: 1,
            captainId: member.id,
            teamPot: 1000,
            lineageRootCaptainId: member.id,
            displayName: member.name,
          })
          .returning();

        await tx.insert(teamMembers).values({
          teamId: team.id,
          participantId: member.id,
        });

        await tx
          .update(participants)
          .set({
            currentTeamId: team.id,
            r1LineageRootId: member.id,
          })
          .where(eq(participants.id, member.id));

        await tx.insert(bankrollLedger).values({
          kind: "seed",
          participantId: member.id,
          teamId: team.id,
          delta: 0, // seed row: 1000₿ personal → 1000₿ pot, net zero for conservation
          reason: "R1 solo team seeded with 1000 ₿",
          byUserId: opts.byUserId,
        });

        // Personal bankroll -> team pot stake.
        await tx
          .update(participants)
          .set({ personalBankroll: 0 })
          .where(eq(participants.id, member.id));
        await tx.insert(bankrollLedger).values({
          kind: "stake",
          participantId: member.id,
          teamId: team.id,
          delta: -1000,
          reason: "R1 stake",
          byUserId: opts.byUserId,
        });
        await tx.insert(bankrollLedger).values({
          kind: "stake",
          teamId: team.id,
          delta: 1000,
          reason: "R1 stake",
          byUserId: opts.byUserId,
        });

        teamIdByParticipant.set(member.id, team.id);
        teamsCreated += 1;
      }
    }

    for (const m of r1) {
      const aTeamId = teamIdByParticipant.get(m.teamA.id);
      const bTeamId = teamIdByParticipant.get(m.teamB.id);
      if (!aTeamId || !bTeamId) continue;
      await tx.insert(battles).values({
        roundNumber: 1,
        isPlayIn: false,
        teamAId: aTeamId,
        teamBId: bTeamId,
        scheduledStart: opts.scheduledStart,
        roundDurationMinutes: durationMinutes,
        bettingClosesAt: betClose,
        stakeA: 1000,
        stakeB: 1000,
        combinedPool: 2000,
        status: "pending",
      });
      battlesCreated += 1;
    }
  });

  return { teamsCreated, battlesCreated };
}

/**
 * DANGER: wipes all tournament state (teams, battles, bets, votes, ledger)
 * without touching participants. For re-seeding during dry runs.
 */
export async function resetTournamentState(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(bankrollLedger);
    await tx.delete(battles);
    await tx.delete(teamMembers);
    await tx.delete(teams);
    await tx
      .update(participants)
      .set({
        currentTeamId: null,
        r1LineageRootId: null,
        eliminatedByTeamId: null,
        personalBankroll: 1000,
        isPlayInParticipant: false,
        playInRole: null,
        playInResult: null,
        mentorHonorBonus: 0,
        learnerBankroll: 0,
      });
  });
}

/** Used by override action to regenerate matchups for a round (if no battle started). */
export async function ensureNoBattleStartedForRound(round: number) {
  const rows = await db
    .select({ id: battles.id, status: battles.status })
    .from(battles)
    .where(eq(battles.roundNumber, round));
  const anyStarted = rows.some((r) => r.status !== "pending");
  if (anyStarted) {
    throw new Error(
      `Round ${round} has battles past pending; cannot regenerate.`,
    );
  }
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(battles).where(inArray(battles.id, ids));
  }
}

// Small helper for admin pages — exposes the `and`/`eq` imports used above.
export const _ = { and, eq };
