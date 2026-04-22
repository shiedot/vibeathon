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
  roster: {
    id: string;
    name: string;
    department: string;
    experienceScore: number;
    rank: number;
  }[];
  /**
   * True when the eligible roster exceeds 64 — play-in is required before
   * commit. Preview is computed against the top-64-by-score as a speculative
   * view so the admin can still eyeball the shape of the bracket.
   */
  overCap: boolean;
  /** Total count of participants eligible before the 64-cap truncation. */
  totalEligible: number;
  /** Rows dropped to fit the 64-cap, ranked (lowest score first). */
  belowCap: {
    id: string;
    name: string;
    department: string;
    experienceScore: number;
    rank: number;
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
      shippingConfidence: participants.shippingConfidence,
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
      experienceScore: experienceScore(
        r.yearsCoding,
        r.comfortLevel,
        r.shippingConfidence,
      ),
    }));
}

export async function previewPods(): Promise<PodsPreview> {
  const roster = await loadReadyRoster();
  if (roster.length === 0) {
    return {
      pods: [],
      r1Matchups: [],
      roster: [],
      overCap: false,
      totalEligible: 0,
      belowCap: [],
    };
  }

  const rankedAll = roster
    .slice()
    .sort((a, b) => {
      if (b.experienceScore !== a.experienceScore) {
        return b.experienceScore - a.experienceScore;
      }
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      return a.id.localeCompare(b.id);
    })
    .map((r, i) => ({
      id: r.id,
      name: r.name,
      department: r.department,
      experienceScore: r.experienceScore,
      rank: i + 1,
      preferredPitchLanguage: r.preferredPitchLanguage,
    }));

  const overCap = roster.length > 64;
  // Snake-draft + R1 pairing require even pod sizes; also cap at 64 per spec.
  // When over cap we speculatively preview on the top 64 by score so the admin
  // can still eyeball the bracket shape; commit will refuse separately.
  const seedable = rankedAll.slice(0, overCap ? 64 : rankedAll.length);
  // Drop a trailing entry to keep even pairing if cap is even-divisible but
  // current roster is odd (only possible when not over cap; e.g. 63 humans).
  const truncated = seedable.length % 2 === 0
    ? seedable
    : seedable.slice(0, seedable.length - 1);

  const pods = snakeDraftPods(
    truncated.map((r) => ({
      id: r.id,
      name: r.name,
      department: r.department,
      preferredPitchLanguage: r.preferredPitchLanguage,
      experienceScore: r.experienceScore,
    })),
    8,
  );
  const r1 = generateR1Matchups(pods);

  const rankedForUi = rankedAll.map(({ preferredPitchLanguage: _pl, ...r }) => r);
  const belowCap = overCap
    ? rankedForUi.slice(64).slice().reverse()
    : [];

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
    roster: rankedForUi.slice(0, truncated.length),
    overCap,
    totalEligible: rankedAll.length,
    belowCap,
  };
}

export type CommitMatchup = {
  podId: number;
  teamAParticipantId: string;
  teamBParticipantId: string;
};

/**
 * Commit: creates a solo team per participant, a team_members link, an R1
 * battle per pair, plus a `seed` ledger row per participant recording the
 * 1000 ₿ initial stake.
 *
 * `matchups` lets the admin override the auto-paired seed. Each row must
 * reference distinct participants, every participant must appear in exactly
 * one matchup, and podId ∈ 1..8.
 *
 * Idempotency: refuses to run if any teams/battles already exist.
 */
export async function commitPodsAndR1(opts: {
  matchups: CommitMatchup[];
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
  if (roster.length > 64) {
    throw new Error(
      `Roster has ${roster.length} ready participants; run play-in first to cap at 64.`,
    );
  }

  const byId = new Map(roster.map((r) => [r.id, r]));
  const seen = new Set<string>();
  for (const m of opts.matchups) {
    if (!Number.isInteger(m.podId) || m.podId < 1 || m.podId > 8) {
      throw new Error(`Invalid pod id ${m.podId}; must be 1..8.`);
    }
    if (m.teamAParticipantId === m.teamBParticipantId) {
      throw new Error(
        `Matchup in pod ${m.podId} has the same participant on both sides.`,
      );
    }
    for (const pid of [m.teamAParticipantId, m.teamBParticipantId]) {
      if (!byId.has(pid)) {
        throw new Error(`Unknown or ineligible participant in matchup: ${pid}`);
      }
      if (seen.has(pid)) {
        throw new Error(
          `Participant ${byId.get(pid)?.name ?? pid} is in more than one matchup.`,
        );
      }
      seen.add(pid);
    }
  }
  if (seen.size !== roster.length) {
    throw new Error(
      `Matchups cover ${seen.size} participants but roster has ${roster.length}.`,
    );
  }
  if (opts.matchups.length * 2 !== roster.length) {
    throw new Error(
      `Matchup count ${opts.matchups.length} doesn't fit roster of ${roster.length}.`,
    );
  }

  const durationMinutes = ROUND_DEFS[1].durationMinutes;
  const betClose = bettingClosesAt(opts.scheduledStart, durationMinutes);

  let teamsCreated = 0;
  let battlesCreated = 0;

  await db.transaction(async (tx) => {
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

    async function ensureTeam(participantId: string, podId: number) {
      const member = byId.get(participantId)!;
      const [team] = await tx
        .insert(teams)
        .values({
          podId,
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
        delta: 0,
        reason: "R1 solo team seeded with 1000 ₿",
        byUserId: opts.byUserId,
      });

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

    for (const m of opts.matchups) {
      await ensureTeam(m.teamAParticipantId, m.podId);
      await ensureTeam(m.teamBParticipantId, m.podId);
    }

    for (const m of opts.matchups) {
      const aTeamId = teamIdByParticipant.get(m.teamAParticipantId)!;
      const bTeamId = teamIdByParticipant.get(m.teamBParticipantId)!;
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
    await tx.update(participants).set({
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

export const _ = { and, eq };
