import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bankrollLedger,
  battles,
  bets,
  consensusVotes,
  participants,
  prizeLedger,
  teamMembers,
  teams,
  type Battle,
} from "@/db/schema";
import { resolveBattle } from "@/lib/bankroll";
import { advanceRound, type RoundWinner } from "@/lib/round-advance";
import { ROUND_DEFS, bettingClosesAt, roundKeyOrNull } from "@/lib/time";
import { evaluateConsensus, tallyVotes } from "@/lib/voting";
import { settleBetsForBattle } from "./bets";

export type StartBattleResult = { id: string; bettingClosesAt: Date };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function startBattle(
  battleId: string,
  byUserId: string,
): Promise<StartBattleResult> {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, battleId))
    .limit(1);
  if (!battle) throw new Error("Battle not found");
  if (battle.status !== "pending") {
    throw new Error(`Cannot start battle in status ${battle.status}`);
  }
  const now = new Date();
  const close = bettingClosesAt(now, battle.roundDurationMinutes);

  const result = await db
    .update(battles)
    .set({
      status: "voting",
      actualStart: now,
      bettingClosesAt: close,
    })
    .where(and(eq(battles.id, battleId), eq(battles.status, "pending")))
    .returning();
  if (result.length === 0) {
    throw new Error("Battle start conflicted; refresh and retry.");
  }
  void byUserId;
  return { id: battleId, bettingClosesAt: close };
}

export async function startRound(
  round: number,
  byUserId: string,
): Promise<{ started: number }> {
  const rows = await db
    .select({ id: battles.id, status: battles.status })
    .from(battles)
    .where(eq(battles.roundNumber, round));
  let started = 0;
  for (const r of rows) {
    if (r.status === "pending") {
      await startBattle(r.id, byUserId);
      started += 1;
    }
  }
  return { started };
}

type RoundResolutionRow = {
  id: string;
  status: Battle["status"];
  winnerTeamId: string | null;
  roundNumber: number;
};

export async function castVote(opts: {
  battleId: string;
  voterId: string;
  teamVotedForId: string;
}): Promise<{ status: Battle["status"]; winner?: string }> {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, opts.battleId))
    .limit(1);
  if (!battle) throw new Error("Battle not found");
  if (battle.status !== "voting") {
    throw new Error(`Voting is not open (status=${battle.status})`);
  }
  if (
    opts.teamVotedForId !== battle.teamAId &&
    opts.teamVotedForId !== battle.teamBId
  ) {
    throw new Error("Vote must be for team A or B");
  }

  // Caller must be a current member of team A or team B.
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.participantId, opts.voterId),
        isNull(teamMembers.leftAt),
        inArray(teamMembers.teamId, [battle.teamAId, battle.teamBId]),
      ),
    );
  if (memberships.length === 0) {
    throw new Error("You are not eligible to vote in this matchup");
  }

  await db
    .insert(consensusVotes)
    .values({
      battleId: opts.battleId,
      voterId: opts.voterId,
      teamVotedForId: opts.teamVotedForId,
    })
    .onConflictDoUpdate({
      target: [consensusVotes.battleId, consensusVotes.voterId],
      set: { teamVotedForId: opts.teamVotedForId, castAt: new Date() },
    });

  return await attemptResolve(opts.battleId);
}

async function countActiveMembers(teamId: string): Promise<number> {
  const rows = await db
    .select({ id: teamMembers.participantId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt)));
  return rows.length;
}

export async function attemptResolve(
  battleId: string,
): Promise<{ status: Battle["status"]; winner?: string }> {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, battleId))
    .limit(1);
  if (!battle) throw new Error("Battle not found");
  if (battle.status !== "voting") return { status: battle.status };

  const [aCount, bCount] = await Promise.all([
    countActiveMembers(battle.teamAId),
    countActiveMembers(battle.teamBId),
  ]);

  const votes = await db
    .select({ teamVotedForId: consensusVotes.teamVotedForId })
    .from(consensusVotes)
    .where(eq(consensusVotes.battleId, battleId));

  const tally = tallyVotes({
    teamAVoterCount: aCount,
    teamBVoterCount: bCount,
    teamAId: battle.teamAId,
    teamBId: battle.teamBId,
    votes,
    judgeVotes: battle.judgeVotes,
  });
  const outcome = evaluateConsensus(tally);

  if (outcome.kind === "majority") {
    const winnerId =
      outcome.winner === "A" ? battle.teamAId : battle.teamBId;
    await resolveWithWinner(battle, winnerId, null);
    await maybeAdvanceRound(battle.roundNumber);
    return { status: "resolved", winner: winnerId };
  }
  if (outcome.kind === "deadlocked") {
    await db
      .update(battles)
      .set({ status: "deadlocked" })
      .where(eq(battles.id, battleId));
    return { status: "deadlocked" };
  }
  return { status: "voting" };
}

/**
 * Core money transfer + team merger. Only called when a winner is known
 * (via consensus or judge decide). Snapshot saved for reverseBattleResolution.
 */
export async function resolveWithWinner(
  battle: Battle,
  winnerTeamId: string,
  judgeNote: string | null,
  opts?: { byUserId?: string },
) {
  const loserTeamId =
    winnerTeamId === battle.teamAId ? battle.teamBId : battle.teamAId;
  const [winnerTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, winnerTeamId))
    .limit(1);
  const [loserTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, loserTeamId))
    .limit(1);
  if (!winnerTeam || !loserTeam) throw new Error("Team lookup failed");

  const loserMembers = await db
    .select({
      participantId: teamMembers.participantId,
    })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, loserTeamId), isNull(teamMembers.leftAt)),
    );
  const winnerMembers = await db
    .select({ participantId: teamMembers.participantId })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, winnerTeamId), isNull(teamMembers.leftAt)),
    );

  const math = resolveBattle({
    winnerTeamPot: winnerTeam.teamPot,
    loserTeamPot: loserTeam.teamPot,
  });

  const snapshot = {
    teamAPot: winnerTeamId === battle.teamAId ? winnerTeam.teamPot : loserTeam.teamPot,
    teamBPot: winnerTeamId === battle.teamBId ? winnerTeam.teamPot : loserTeam.teamPot,
    teamAMembers:
      winnerTeamId === battle.teamAId
        ? winnerMembers.map((m) => m.participantId)
        : loserMembers.map((m) => m.participantId),
    teamBMembers:
      winnerTeamId === battle.teamBId
        ? winnerMembers.map((m) => m.participantId)
        : loserMembers.map((m) => m.participantId),
    teamACaptain: winnerTeamId === battle.teamAId ? winnerTeam.captainId : loserTeam.captainId,
    teamBCaptain: winnerTeamId === battle.teamBId ? winnerTeam.captainId : loserTeam.captainId,
  };

  await db.transaction(async (tx) => {
    // Update winning team pot.
    await tx
      .update(teams)
      .set({
        teamPot: math.newWinnerTeamPot,
        currentRound: battle.roundNumber + 1,
      })
      .where(eq(teams.id, winnerTeamId));

    // Ledger: team pots go -> combined; simpler representation:
    await tx.insert(bankrollLedger).values({
      kind: "win_pot",
      teamId: winnerTeamId,
      battleId: battle.id,
      delta: math.newWinnerTeamPot - winnerTeam.teamPot,
      reason: `Won R${battle.roundNumber} battle`,
      byUserId: opts?.byUserId,
    });
    await tx.insert(bankrollLedger).values({
      kind: "win_pot",
      teamId: loserTeamId,
      battleId: battle.id,
      delta: -loserTeam.teamPot,
      reason: `Lost R${battle.roundNumber} battle (pot drained)`,
      byUserId: opts?.byUserId,
    });

    // Deactivate loser team.
    await tx
      .update(teams)
      .set({ teamPot: 0, isActive: false })
      .where(eq(teams.id, loserTeamId));

    // Losing captain pockets 20%.
    await tx
      .update(participants)
      .set({
        personalBankroll: sql`${participants.personalBankroll} + ${math.loserCaptainConsolation}`,
      })
      .where(eq(participants.id, loserTeam.captainId));
    await tx.insert(bankrollLedger).values({
      kind: "consol",
      participantId: loserTeam.captainId,
      battleId: battle.id,
      delta: math.loserCaptainConsolation,
      reason: `R${battle.roundNumber} losing-captain 20% consolation`,
      byUserId: opts?.byUserId,
    });

    // Transfer loser members into winner team.
    for (const m of loserMembers) {
      await tx
        .update(teamMembers)
        .set({ leftAt: new Date() })
        .where(
          and(
            eq(teamMembers.teamId, loserTeamId),
            eq(teamMembers.participantId, m.participantId),
          ),
        );
      await tx
        .insert(teamMembers)
        .values({
          teamId: winnerTeamId,
          participantId: m.participantId,
        })
        .onConflictDoNothing();
      await tx
        .update(participants)
        .set({
          currentTeamId: winnerTeamId,
          eliminatedByTeamId: winnerTeamId,
        })
        .where(eq(participants.id, m.participantId));
    }

    // Settle bets on this battle.
    await settleBetsForBattle(tx, battle.id, winnerTeamId, opts?.byUserId);

    // Persist resolution + snapshot.
    await tx
      .update(battles)
      .set({
        status: "resolved",
        winnerTeamId,
        actualEnd: new Date(),
        judgeInterventionNote: judgeNote,
        preResolveSnapshot: snapshot,
        stakeA:
          winnerTeamId === battle.teamAId
            ? winnerTeam.teamPot
            : loserTeam.teamPot,
        stakeB:
          winnerTeamId === battle.teamBId
            ? winnerTeam.teamPot
            : loserTeam.teamPot,
        combinedPool: math.combinedPool,
      })
      .where(eq(battles.id, battle.id));
  });
}

export type JudgeDecideInput = {
  battleId: string;
  outcome: "pickWinner" | "flipCoin" | "dqBoth";
  winnerTeamId?: string;
  note: string;
  byUserId: string;
};

export async function judgeDecide(input: JudgeDecideInput) {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, input.battleId))
    .limit(1);
  if (!battle) throw new Error("Battle not found");
  if (battle.status !== "deadlocked" && battle.status !== "voting") {
    throw new Error(
      `Judge can only decide deadlocked or voting battles (status=${battle.status})`,
    );
  }
  if (input.outcome === "dqBoth") {
    await db
      .update(battles)
      .set({
        status: "disqualified",
        judgeInterventionNote: input.note,
        actualEnd: new Date(),
      })
      .where(eq(battles.id, input.battleId));
    // Both teams' pots stay with them? Spec says opponent advances with a bye.
    // Mark both teams inactive; no pot transfer.
    await db
      .update(teams)
      .set({ isActive: false })
      .where(inArray(teams.id, [battle.teamAId, battle.teamBId]));
    await maybeAdvanceRound(battle.roundNumber);
    return { status: "disqualified" as const };
  }
  let winnerTeamId: string;
  if (input.outcome === "flipCoin") {
    winnerTeamId = Math.random() < 0.5 ? battle.teamAId : battle.teamBId;
  } else {
    if (
      !input.winnerTeamId ||
      (input.winnerTeamId !== battle.teamAId &&
        input.winnerTeamId !== battle.teamBId)
    ) {
      throw new Error("pickWinner requires a valid winnerTeamId");
    }
    winnerTeamId = input.winnerTeamId;
  }
  await resolveWithWinner(battle, winnerTeamId, input.note, {
    byUserId: input.byUserId,
  });
  await maybeAdvanceRound(battle.roundNumber);
  return { status: "resolved" as const, winner: winnerTeamId };
}

export async function maybeAdvanceRound(completedRound: number) {
  if (completedRound >= 6) return;
  const key = roundKeyOrNull(completedRound);
  if (!key) return;

  const rows = await getRoundResolutionRows(completedRound);
  const allDone = rows.every(
    (r) => r.status === "resolved" || r.status === "disqualified",
  );
  if (!allDone) return;

  // If the next round already has battles, nothing to do.
  const nextExisting = await db
    .select({ id: battles.id })
    .from(battles)
    .where(eq(battles.roundNumber, completedRound + 1))
    .limit(1);
  if (nextExisting.length > 0) return;

  try {
    await createNextRoundFromRows(completedRound, rows);
  } catch (err) {
    // Odd winner count (e.g. after a DQ-both) or missing pod winners — leave
    // the next round empty and let an organizer fix it explicitly.
    console.warn(
      `[maybeAdvanceRound] auto-advance skipped for round ${completedRound}: ${(err as Error).message}`,
    );
  }
}

export async function advanceCompletedRound(
  completedRound: number,
): Promise<{ created: number; nextRound: number }> {
  if (completedRound >= 6) {
    throw new Error("Grand Final is the last round.");
  }
  const key = roundKeyOrNull(completedRound);
  if (!key) {
    throw new Error(`Round ${completedRound} is not a valid tournament round.`);
  }

  const rows = await getRoundResolutionRows(completedRound);
  if (rows.length === 0) {
    throw new Error(`Round ${completedRound} has no battles yet.`);
  }

  const unresolved = rows.filter(
    (r) => r.status !== "resolved" && r.status !== "disqualified",
  );
  if (unresolved.length > 0) {
    throw new Error(
      `Round ${completedRound} still has ${unresolved.length} unresolved battle${unresolved.length === 1 ? "" : "s"}.`,
    );
  }

  const nextRound = completedRound + 1;
  const nextExisting = await db
    .select({ id: battles.id })
    .from(battles)
    .where(eq(battles.roundNumber, nextRound))
    .limit(1);
  if (nextExisting.length > 0) {
    throw new Error(`Round ${nextRound} already exists.`);
  }

  return await createNextRoundFromRows(completedRound, rows);
}

async function getRoundResolutionRows(
  roundNumber: number,
): Promise<RoundResolutionRow[]> {
  return await db
    .select({
      id: battles.id,
      status: battles.status,
      winnerTeamId: battles.winnerTeamId,
      roundNumber: battles.roundNumber,
    })
    .from(battles)
    .where(eq(battles.roundNumber, roundNumber));
}

async function createNextRoundFromRows(
  completedRound: number,
  rows: RoundResolutionRow[],
): Promise<{ created: number; nextRound: number }> {
  const matchups = await buildNextRoundMatchups(completedRound, rows);
  return await insertNextRoundMatchups(matchups);
}

export async function syncNextRoundFromCompletedRound(
  completedRound: number,
): Promise<{ created: number; nextRound: number } | null> {
  if (completedRound >= 6) return null;

  const rows = await getRoundResolutionRows(completedRound);
  if (rows.length === 0) return null;

  const unresolved = rows.some(
    (row) => row.status !== "resolved" && row.status !== "disqualified",
  );
  if (unresolved) return null;

  const matchups = await buildNextRoundMatchups(completedRound, rows);
  const nextRound = completedRound + 1;
  const existing = await db
    .select({
      id: battles.id,
      teamAId: battles.teamAId,
      teamBId: battles.teamBId,
    })
    .from(battles)
    .where(eq(battles.roundNumber, nextRound));

  const existingKeys = new Set(
    existing.map((battle) => matchupKey(battle.teamAId, battle.teamBId)),
  );
  const missing = matchups.matchups.filter(
    (matchup) =>
      !existingKeys.has(matchupKey(matchup.teamAId, matchup.teamBId)),
  );
  if (missing.length === 0) {
    return { created: 0, nextRound };
  }

  return await insertNextRoundMatchups({ ...matchups, matchups: missing });
}

async function buildNextRoundMatchups(
  completedRound: number,
  rows: RoundResolutionRow[],
): Promise<{
  matchups: Awaited<ReturnType<typeof advanceRound>>;
  nextRound: number;
  duration: number;
  scheduled: Date;
}> {
  const nextRound = completedRound + 1;

  // Build winners list.
  const winners: RoundWinner[] = [];
  for (const r of rows) {
    if (!r.winnerTeamId) continue;
    const [t] = await db
      .select({ id: teams.id, podId: teams.podId })
      .from(teams)
      .where(eq(teams.id, r.winnerTeamId))
      .limit(1);
    if (!t) continue;
    winners.push({ teamId: t.id, podId: t.podId ?? null, battleId: r.id });
  }

  let matchups;
  try {
    matchups = advanceRound(completedRound as 1 | 2 | 3 | 4 | 5, winners);
  } catch (err) {
    throw new Error(
      `Could not create round ${nextRound}: ${(err as Error).message}`,
    );
  }
  const nextKey = nextRound as 1 | 2 | 3 | 4 | 5 | 6;
  const duration = ROUND_DEFS[nextKey].durationMinutes;
  const scheduled = new Date(Date.now() + 10 * 60 * 1000); // 10-min buffer default

  return { matchups, nextRound, duration, scheduled };
}

async function insertNextRoundMatchups(opts: {
  matchups: Awaited<ReturnType<typeof advanceRound>>;
  nextRound: number;
  duration: number;
  scheduled: Date;
}): Promise<{ created: number; nextRound: number }> {
  for (const m of opts.matchups) {
    await db.insert(battles).values({
      roundNumber: m.roundNumber,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      scheduledStart: opts.scheduled,
      roundDurationMinutes: opts.duration,
      bettingClosesAt: bettingClosesAt(opts.scheduled, opts.duration),
      status: "pending",
    });
  }

  return { created: opts.matchups.length, nextRound: opts.nextRound };
}

function matchupKey(teamAId: string, teamBId: string): string {
  return [teamAId, teamBId].sort().join(":");
}

/**
 * Reverse a resolved battle: restore team membership, refund bets, negate
 * ledger rows. Admin-only path via overrides.ts.
 */
export async function reverseResolution(battleId: string, byUserId: string) {
  await db.transaction(async (tx) => {
    const battle = await getBattleOrThrow(tx, battleId);
    if (battle.status !== "resolved" || !battle.preResolveSnapshot) {
      throw new Error("Battle is not resolved or has no snapshot");
    }
    await reverseBattleToVotingInTx(tx, battle, byUserId);
    await tx.delete(prizeLedger);
  });
}

export async function editResolvedBattleWinner(opts: {
  battleId: string;
  winnerTeamId: string;
  byUserId: string;
}): Promise<void> {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, opts.battleId))
    .limit(1);
  if (!battle) throw new Error("Battle not found");
  if (battle.status !== "resolved" || !battle.preResolveSnapshot) {
    throw new Error("Only resolved battles can change winner.");
  }
  if (
    opts.winnerTeamId !== battle.teamAId &&
    opts.winnerTeamId !== battle.teamBId
  ) {
    throw new Error("Winner must be team A or team B");
  }
  if (battle.winnerTeamId === opts.winnerTeamId) {
    return;
  }

  await db.transaction(async (tx) => {
    const freshBattle = await getBattleOrThrow(tx, opts.battleId);
    await reverseBattleToVotingInTx(tx, freshBattle, opts.byUserId);
    await tx.delete(prizeLedger);
  });

  await resolveWithWinner(
    battle,
    opts.winnerTeamId,
    "Admin edited winner after resolution",
    { byUserId: opts.byUserId },
  );
  await syncNextRoundFromCompletedRound(battle.roundNumber);
}

async function reverseBattleToVotingInTx(
  tx: Tx,
  battle: Battle,
  byUserId: string,
) {
  const child = await findChildBattle(tx, battle);
  if (child) {
    await deleteBattleBranchInTx(tx, child, byUserId);
  }

  await undoResolvedBattleInTx(tx, battle, byUserId);
  await tx
    .update(battles)
    .set({
      status: "voting",
      winnerTeamId: null,
      actualEnd: null,
      judgeInterventionNote: null,
      preResolveSnapshot: null,
      stakeA: 0,
      stakeB: 0,
      combinedPool: 0,
    })
    .where(eq(battles.id, battle.id));

  await tx.insert(bankrollLedger).values({
    kind: "admin_override",
    battleId: battle.id,
    delta: 0,
    reason: "Battle reversed to voting",
    byUserId,
  });
}

async function deleteBattleBranchInTx(
  tx: Tx,
  battle: Battle,
  byUserId: string,
) {
  const child = await findChildBattle(tx, battle);
  if (child) {
    await deleteBattleBranchInTx(tx, child, byUserId);
  }

  if (battle.status === "resolved") {
    await undoResolvedBattleInTx(tx, battle, byUserId);
  } else if (battle.status === "disqualified") {
    await undoDisqualifiedBattleInTx(tx, battle, byUserId);
  } else {
    await refundBattleBetsInTx(tx, battle.id, byUserId);
  }

  await tx.delete(battles).where(eq(battles.id, battle.id));
}

async function undoResolvedBattleInTx(
  tx: Tx,
  battle: Battle,
  byUserId: string,
) {
  if (!battle.preResolveSnapshot || !battle.winnerTeamId) {
    throw new Error("Resolved battle is missing reversal snapshot data.");
  }
  const snap = battle.preResolveSnapshot;

  await tx
    .update(teams)
    .set({ teamPot: snap.teamAPot, isActive: true, currentRound: battle.roundNumber })
    .where(eq(teams.id, battle.teamAId));
  await tx
    .update(teams)
    .set({ teamPot: snap.teamBPot, isActive: true, currentRound: battle.roundNumber })
    .where(eq(teams.id, battle.teamBId));

  for (const pid of snap.teamAMembers) {
    await tx
      .update(teamMembers)
      .set({ leftAt: null })
      .where(
        and(
          eq(teamMembers.participantId, pid),
          eq(teamMembers.teamId, battle.teamAId),
        ),
      );
    await tx
      .update(participants)
      .set({ currentTeamId: battle.teamAId, eliminatedByTeamId: null })
      .where(eq(participants.id, pid));
    await tx
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.participantId, pid),
          ne(teamMembers.teamId, battle.teamAId),
        ),
      );
  }

  for (const pid of snap.teamBMembers) {
    await tx
      .update(teamMembers)
      .set({ leftAt: null })
      .where(
        and(
          eq(teamMembers.participantId, pid),
          eq(teamMembers.teamId, battle.teamBId),
        ),
      );
    await tx
      .update(participants)
      .set({ currentTeamId: battle.teamBId, eliminatedByTeamId: null })
      .where(eq(participants.id, pid));
    await tx
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.participantId, pid),
          ne(teamMembers.teamId, battle.teamBId),
        ),
      );
  }

  const math = resolveBattle({
    winnerTeamPot:
      battle.winnerTeamId === battle.teamAId ? snap.teamAPot : snap.teamBPot,
    loserTeamPot:
      battle.winnerTeamId === battle.teamAId ? snap.teamBPot : snap.teamAPot,
  });
  const loserCaptain =
    battle.winnerTeamId === battle.teamAId ? snap.teamBCaptain : snap.teamACaptain;
  await tx
    .update(participants)
    .set({
      personalBankroll: sql`${participants.personalBankroll} - ${math.loserCaptainConsolation}`,
    })
    .where(eq(participants.id, loserCaptain));
  await tx.insert(bankrollLedger).values({
    kind: "admin_override",
    participantId: loserCaptain,
    battleId: battle.id,
    delta: -math.loserCaptainConsolation,
    reason: "Reverse consolation (admin reversal)",
    byUserId,
  });

  await refundBattleBetsInTx(tx, battle.id, byUserId);
}

async function undoDisqualifiedBattleInTx(
  tx: Tx,
  battle: Battle,
  byUserId: string,
) {
  await tx
    .update(teams)
    .set({ isActive: true, currentRound: battle.roundNumber })
    .where(inArray(teams.id, [battle.teamAId, battle.teamBId]));
  await refundBattleBetsInTx(tx, battle.id, byUserId);
}

async function refundBattleBetsInTx(
  tx: Tx,
  battleId: string,
  byUserId: string,
) {
  const battleBets = await tx.select().from(bets).where(eq(bets.battleId, battleId));
  for (const b of battleBets) {
    if (b.payoutAmount && b.payoutAmount > 0) {
      await tx
        .update(participants)
        .set({
          personalBankroll: sql`${participants.personalBankroll} - ${b.payoutAmount}`,
        })
        .where(eq(participants.id, b.bettorId));
      await tx.insert(bankrollLedger).values({
        kind: "admin_override",
        participantId: b.bettorId,
        battleId,
        betId: b.id,
        delta: -b.payoutAmount,
        reason: "Reverse bet payout",
        byUserId,
      });
    }

    if (!b.refunded) {
      await tx
        .update(participants)
        .set({
          personalBankroll: sql`${participants.personalBankroll} + ${b.stakeAmount}`,
        })
        .where(eq(participants.id, b.bettorId));
      await tx.insert(bankrollLedger).values({
        kind: "bet_refund",
        participantId: b.bettorId,
        battleId,
        betId: b.id,
        delta: b.stakeAmount,
        reason: "Stake refund on reversal",
        byUserId,
      });
    }
  }

  await tx.delete(bets).where(eq(bets.battleId, battleId));
}

async function findChildBattle(tx: Tx, battle: Battle): Promise<Battle | null> {
  if (!battle.winnerTeamId || battle.roundNumber >= 6) {
    return null;
  }

  const [child] = await tx
    .select()
    .from(battles)
    .where(
      and(
        eq(battles.roundNumber, battle.roundNumber + 1),
        or(
          eq(battles.teamAId, battle.winnerTeamId),
          eq(battles.teamBId, battle.winnerTeamId),
        ),
      ),
    )
    .limit(1);

  return child ?? null;
}

async function getBattleOrThrow(tx: Tx, battleId: string): Promise<Battle> {
  const [battle] = await tx
    .select()
    .from(battles)
    .where(eq(battles.id, battleId))
    .limit(1);
  if (!battle) {
    throw new Error("Battle not found");
  }
  return battle;
}
