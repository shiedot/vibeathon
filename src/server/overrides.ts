import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bankrollLedger,
  battles,
  participants,
  teamMembers,
  teams,
} from "@/db/schema";
import {
  resolveWithWinner,
  reverseResolution,
} from "./battles";
import { refundBet } from "./bets";
import { ensureNoBattleStartedForRound } from "./pods";

export async function adjustBankroll(opts: {
  participantId: string;
  delta: number;
  reason: string;
  byUserId: string;
}) {
  if (!Number.isInteger(opts.delta) || opts.delta === 0) {
    throw new Error("Delta must be a non-zero integer");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(participants)
      .set({
        personalBankroll: sql`${participants.personalBankroll} + ${opts.delta}`,
      })
      .where(eq(participants.id, opts.participantId));
    await tx.insert(bankrollLedger).values({
      kind: "admin_override",
      participantId: opts.participantId,
      delta: opts.delta,
      reason: opts.reason,
      byUserId: opts.byUserId,
    });
  });
}

export async function adjustTeamPot(opts: {
  teamId: string;
  delta: number;
  reason: string;
  byUserId: string;
}) {
  if (!Number.isInteger(opts.delta) || opts.delta === 0) {
    throw new Error("Delta must be a non-zero integer");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(teams)
      .set({
        teamPot: sql`${teams.teamPot} + ${opts.delta}`,
      })
      .where(eq(teams.id, opts.teamId));
    await tx.insert(bankrollLedger).values({
      kind: "admin_override",
      teamId: opts.teamId,
      delta: opts.delta,
      reason: opts.reason,
      byUserId: opts.byUserId,
    });
  });
}

export async function forceResolveBattle(opts: {
  battleId: string;
  winnerTeamId: string;
  reason: string;
  byUserId: string;
}) {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, opts.battleId))
    .limit(1);
  if (!battle) throw new Error("Battle not found");
  if (battle.status === "resolved") {
    throw new Error("Battle already resolved; reverse first if you want to re-run");
  }
  if (
    opts.winnerTeamId !== battle.teamAId &&
    opts.winnerTeamId !== battle.teamBId
  ) {
    throw new Error("Winner must be team A or team B");
  }
  await resolveWithWinner(battle, opts.winnerTeamId, opts.reason, {
    byUserId: opts.byUserId,
  });
}

export async function reverseBattle(opts: {
  battleId: string;
  byUserId: string;
}) {
  await reverseResolution(opts.battleId, opts.byUserId);
}

export async function refundBetOverride(opts: {
  betId: string;
  byUserId: string;
}) {
  await refundBet(opts.betId, opts.byUserId);
}

export async function moveParticipantToTeam(opts: {
  participantId: string;
  teamId: string;
  reason: string;
  byUserId: string;
}) {
  await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(participants)
      .where(eq(participants.id, opts.participantId))
      .limit(1);
    if (!p) throw new Error("Participant not found");
    if (p.currentTeamId) {
      await tx
        .update(teamMembers)
        .set({ leftAt: new Date() })
        .where(
          and(
            eq(teamMembers.participantId, opts.participantId),
            eq(teamMembers.teamId, p.currentTeamId),
            isNull(teamMembers.leftAt),
          ),
        );
    }
    await tx
      .insert(teamMembers)
      .values({ teamId: opts.teamId, participantId: opts.participantId })
      .onConflictDoNothing();
    await tx
      .update(participants)
      .set({ currentTeamId: opts.teamId })
      .where(eq(participants.id, opts.participantId));
    await tx.insert(bankrollLedger).values({
      kind: "admin_override",
      participantId: opts.participantId,
      teamId: opts.teamId,
      delta: 0,
      reason: `Moved to team (${opts.reason})`,
      byUserId: opts.byUserId,
    });
  });
}

export async function setParticipantRole(opts: {
  participantId: string;
  role: "participant" | "organizer" | "judge";
  byUserId: string;
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(participants)
      .set({ role: opts.role })
      .where(eq(participants.id, opts.participantId));
    await tx.insert(bankrollLedger).values({
      kind: "admin_override",
      participantId: opts.participantId,
      delta: 0,
      reason: `Role set to ${opts.role}`,
      byUserId: opts.byUserId,
    });
  });
}

export async function updateBettingClosesAt(opts: {
  battleId: string;
  at: Date;
  byUserId: string;
}) {
  await db
    .update(battles)
    .set({ bettingClosesAt: opts.at })
    .where(eq(battles.id, opts.battleId));
  await db.insert(bankrollLedger).values({
    kind: "admin_override",
    battleId: opts.battleId,
    delta: 0,
    reason: `Betting close moved to ${opts.at.toISOString()}`,
    byUserId: opts.byUserId,
  });
}

export async function regenerateRoundMatchups(opts: {
  round: number;
  byUserId: string;
}) {
  await ensureNoBattleStartedForRound(opts.round);
  await db.insert(bankrollLedger).values({
    kind: "admin_override",
    delta: 0,
    reason: `Regenerate round ${opts.round} matchups`,
    byUserId: opts.byUserId,
  });
}
