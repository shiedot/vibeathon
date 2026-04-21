import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bankrollLedger,
  battles,
  participants,
  teams,
  teamMembers,
} from "@/db/schema";
import { PLAY_IN_DURATION_MINUTES, bettingClosesAt } from "@/lib/time";
import {
  generatePlayInPairings,
  type PlayInMatchupPreview,
} from "@/lib/pairing";
import { experienceScore } from "@/lib/seeding";

async function classifyRoster() {
  const rows = await db
    .select({
      id: participants.id,
      name: participants.name,
      yearsCoding: participants.yearsCoding,
      comfortLevel: participants.comfortLevel,
      shippingConfidence: participants.shippingConfidence,
      role: participants.role,
    })
    .from(participants);

  const eligible = rows.filter((r) => r.role === "participant");

  const juniors = eligible
    .filter((r) => r.comfortLevel <= 2 && r.yearsCoding <= 2)
    .map((r) => ({
      id: r.id,
      name: r.name,
      experienceScore: experienceScore(
        r.yearsCoding,
        r.comfortLevel,
        r.shippingConfidence,
      ),
    }));
  const seniors = eligible
    .filter((r) => r.comfortLevel >= 3)
    .map((r) => ({
      id: r.id,
      name: r.name,
      experienceScore: experienceScore(
        r.yearsCoding,
        r.comfortLevel,
        r.shippingConfidence,
      ),
    }));
  return { juniors, seniors, total: eligible.length };
}

export async function previewPlayIn(): Promise<{
  matchups: PlayInMatchupPreview[];
  total: number;
}> {
  const { juniors, seniors, total } = await classifyRoster();
  if (total <= 64) return { matchups: [], total };
  const matchups = generatePlayInPairings(juniors, seniors);
  return { matchups, total };
}

export async function commitPlayIn(opts: {
  scheduledStart: Date;
  byUserId: string;
}): Promise<{ battlesCreated: number }> {
  const { matchups } = await previewPlayIn();
  if (matchups.length === 0) return { battlesCreated: 0 };

  let created = 0;
  await db.transaction(async (tx) => {
    for (const m of matchups) {
      const [junior] = await tx
        .select()
        .from(participants)
        .where(eq(participants.id, m.junior.id))
        .limit(1);
      const [senior] = await tx
        .select()
        .from(participants)
        .where(eq(participants.id, m.senior.id))
        .limit(1);
      if (!junior || !senior) continue;

      const [jTeam] = await tx
        .insert(teams)
        .values({
          currentRound: 0,
          captainId: junior.id,
          teamPot: 1000,
          lineageRootCaptainId: junior.id,
          displayName: `Play-in ${junior.name}`,
        })
        .returning();
      const [sTeam] = await tx
        .insert(teams)
        .values({
          currentRound: 0,
          captainId: senior.id,
          teamPot: 1000,
          lineageRootCaptainId: senior.id,
          displayName: `Play-in ${senior.name}`,
        })
        .returning();
      await tx.insert(teamMembers).values({
        teamId: jTeam.id,
        participantId: junior.id,
      });
      await tx.insert(teamMembers).values({
        teamId: sTeam.id,
        participantId: senior.id,
      });

      await tx
        .update(participants)
        .set({
          isPlayInParticipant: true,
          playInRole: "junior",
          currentTeamId: jTeam.id,
          r1LineageRootId: junior.id,
        })
        .where(eq(participants.id, junior.id));
      await tx
        .update(participants)
        .set({
          isPlayInParticipant: true,
          playInRole: "senior_volunteer",
          currentTeamId: sTeam.id,
          r1LineageRootId: senior.id,
        })
        .where(eq(participants.id, senior.id));

      await tx.insert(battles).values({
        roundNumber: 0,
        isPlayIn: true,
        teamAId: jTeam.id,
        teamBId: sTeam.id,
        scheduledStart: opts.scheduledStart,
        roundDurationMinutes: PLAY_IN_DURATION_MINUTES,
        bettingClosesAt: bettingClosesAt(
          opts.scheduledStart,
          PLAY_IN_DURATION_MINUTES,
        ),
        status: "pending",
      });
      created += 1;
    }
  });
  return { battlesCreated: created };
}

export async function resolvePlayIn(
  battleId: string,
  winnerParticipantId: string,
  byUserId: string,
) {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, battleId))
    .limit(1);
  if (!battle) throw new Error("Play-in battle not found");
  if (!battle.isPlayIn) throw new Error("Not a play-in battle");

  const [teamA] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, battle.teamAId))
    .limit(1);
  const [teamB] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, battle.teamBId))
    .limit(1);
  if (!teamA || !teamB) throw new Error("Teams not found");

  const winnerTeamId =
    teamA.captainId === winnerParticipantId ? teamA.id : teamB.id;
  const loserTeamId = winnerTeamId === teamA.id ? teamB.id : teamA.id;

  const [winnerTeam] =
    winnerTeamId === teamA.id ? [teamA] : [teamB];
  const [loserTeam] = winnerTeamId === teamA.id ? [teamB] : [teamA];

  const juniorPid =
    (await db
      .select()
      .from(participants)
      .where(eq(participants.id, winnerTeam.captainId))
      .limit(1))[0]?.playInRole === "junior"
      ? winnerTeam.captainId
      : loserTeam.captainId;
  const seniorPid =
    juniorPid === winnerTeam.captainId ? loserTeam.captainId : winnerTeam.captainId;

  const juniorWon = juniorPid === winnerTeam.captainId;

  await db.transaction(async (tx) => {
    await tx
      .update(battles)
      .set({
        status: "resolved",
        winnerTeamId,
        actualEnd: new Date(),
      })
      .where(eq(battles.id, battleId));

    await tx
      .update(teams)
      .set({ isActive: false, teamPot: 0 })
      .where(eq(teams.id, loserTeamId));
    await tx
      .update(teams)
      .set({ isActive: false, teamPot: 0 })
      .where(eq(teams.id, winnerTeamId));

    await tx
      .update(participants)
      .set({
        playInResult: juniorWon ? "won" : "lost",
      })
      .where(eq(participants.id, juniorPid));
    await tx
      .update(participants)
      .set({
        playInResult: juniorWon ? "lost" : "won",
      })
      .where(eq(participants.id, seniorPid));

    if (juniorWon) {
      // Senior gets a 500 ₿ Mentor's Honor bonus (organizer pot).
      await tx
        .update(participants)
        .set({
          mentorHonorBonus: 500,
          personalBankroll: sql`${participants.personalBankroll} + 500`,
        })
        .where(eq(participants.id, seniorPid));
      await tx.insert(bankrollLedger).values({
        kind: "play_in_bonus",
        participantId: seniorPid,
        battleId,
        delta: 500,
        reason: "Mentor's Honor (play-in upset)",
        byUserId,
      });
      // Junior enters main bracket at full 1000 ₿.
      await tx
        .update(participants)
        .set({
          personalBankroll: 1000,
          currentTeamId: null,
          isPlayInParticipant: true,
        })
        .where(eq(participants.id, juniorPid));
      // Senior is out of the main bracket (playInResult="lost" gates pods).
    } else {
      // Junior receives 200 ₿ Learner's Bankroll for betting.
      await tx
        .update(participants)
        .set({
          learnerBankroll: 200,
          personalBankroll: 200,
          currentTeamId: null,
        })
        .where(eq(participants.id, juniorPid));
      await tx.insert(bankrollLedger).values({
        kind: "play_in_bonus",
        participantId: juniorPid,
        battleId,
        delta: 200,
        reason: "Learner's Bankroll (play-in loss)",
        byUserId,
      });
      // Senior enters main bracket at 1000 ₿.
      await tx
        .update(participants)
        .set({
          personalBankroll: 1000,
          currentTeamId: null,
        })
        .where(eq(participants.id, seniorPid));
    }
  });
}
