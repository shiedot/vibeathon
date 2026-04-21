import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bankrollLedger,
  battles,
  bets,
  participants,
  teams,
} from "@/db/schema";
import {
  MIN_BET,
  canBet,
  maxAllowedBet,
  settleParimutuel,
} from "@/lib/bankroll";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function placeBet(opts: {
  bettorId: string;
  battleId: string;
  teamBackedId: string;
  stakeAmount: number;
  byUserId: string | null;
}): Promise<{ betId: string }> {
  if (!Number.isInteger(opts.stakeAmount) || opts.stakeAmount < MIN_BET) {
    throw new Error(`Minimum bet is ${MIN_BET} ₿`);
  }
  const [participant] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, opts.bettorId))
    .limit(1);
  if (!participant) throw new Error("Bettor not found");

  const max = maxAllowedBet(participant.personalBankroll);
  if (opts.stakeAmount > max) {
    throw new Error(
      `Max bet is ${max} ₿ (50% of personal bankroll ${participant.personalBankroll} ₿)`,
    );
  }

  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, opts.battleId))
    .limit(1);
  if (!battle) throw new Error("Battle not found");
  if (
    opts.teamBackedId !== battle.teamAId &&
    opts.teamBackedId !== battle.teamBId
  ) {
    throw new Error("Must back team A or B");
  }

  // Derive current team lineage for the bettor.
  const [currentTeam] = await db
    .select({
      id: teams.id,
      lineageRootCaptainId: teams.lineageRootCaptainId,
    })
    .from(teams)
    .where(eq(teams.id, participant.currentTeamId ?? ""))
    .limit(1);

  const allowed = canBet({
    participant: {
      r1LineageRootId: participant.r1LineageRootId ?? "",
      currentTeamLineageRootCaptainId: currentTeam?.lineageRootCaptainId ?? "",
      currentTeamId: participant.currentTeamId ?? "",
      eliminatedByTeamId: participant.eliminatedByTeamId,
    },
    battle: {
      teamAId: battle.teamAId,
      teamBId: battle.teamBId,
      bettingClosesAt: battle.bettingClosesAt,
    },
    now: new Date(),
  });
  if (!allowed) {
    throw new Error("You are not eligible to bet on this matchup");
  }

  let betId = "";
  await db.transaction(async (tx) => {
    // Decrement personal bankroll atomically, reject if would go negative.
    const updated = await tx
      .update(participants)
      .set({
        personalBankroll: sql`${participants.personalBankroll} - ${opts.stakeAmount}`,
      })
      .where(
        and(
          eq(participants.id, opts.bettorId),
          sql`${participants.personalBankroll} >= ${opts.stakeAmount}`,
        ),
      )
      .returning({ id: participants.id });
    if (updated.length === 0) {
      throw new Error("Insufficient bankroll (concurrent update)");
    }
    const [inserted] = await tx
      .insert(bets)
      .values({
        bettorId: opts.bettorId,
        battleId: opts.battleId,
        teamBackedId: opts.teamBackedId,
        stakeAmount: opts.stakeAmount,
      })
      .returning();
    betId = inserted.id;
    await tx.insert(bankrollLedger).values({
      kind: "bet_place",
      participantId: opts.bettorId,
      battleId: opts.battleId,
      betId,
      delta: -opts.stakeAmount,
      reason: "Bet placed",
      byUserId: opts.byUserId || null,
    });
  });

  return { betId };
}

export async function closeBetting(battleId: string) {
  await db.update(bets).set({ locked: true }).where(eq(bets.battleId, battleId));
}

/**
 * Settle all bets for a battle inside an open transaction. Called from
 * `resolveWithWinner`.
 */
export async function settleBetsForBattle(
  tx: Tx,
  battleId: string,
  winningTeamId: string,
  byUserId?: string,
) {
  const battleBets = await tx
    .select()
    .from(bets)
    .where(and(eq(bets.battleId, battleId), eq(bets.refunded, false)));
  if (battleBets.length === 0) return;

  const payouts = settleParimutuel(
    battleBets.map((b) => ({
      bettorId: b.bettorId,
      teamBackedId: b.teamBackedId,
      stakeAmount: b.stakeAmount,
    })),
    winningTeamId,
  );
  const byBettor = new Map(payouts.map((p) => [p.bettorId, p]));

  for (const b of battleBets) {
    const payout = byBettor.get(b.bettorId);
    const amount = payout?.payout ?? 0;
    await tx
      .update(bets)
      .set({ locked: true, payoutAmount: amount })
      .where(eq(bets.id, b.id));
    if (amount > 0) {
      await tx
        .update(participants)
        .set({
          personalBankroll: sql`${participants.personalBankroll} + ${amount}`,
        })
        .where(eq(participants.id, b.bettorId));
      await tx.insert(bankrollLedger).values({
        kind: "bet_payout",
        participantId: b.bettorId,
        battleId,
        betId: b.id,
        delta: amount,
        reason: "Bet payout",
        byUserId,
      });
    }
  }
}

export async function refundBet(betId: string, byUserId: string) {
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(bets).where(eq(bets.id, betId)).limit(1);
    if (!b) throw new Error("Bet not found");
    if (b.refunded) throw new Error("Bet already refunded");
    await tx
      .update(participants)
      .set({
        personalBankroll: sql`${participants.personalBankroll} + ${b.stakeAmount}`,
      })
      .where(eq(participants.id, b.bettorId));
    await tx
      .update(bets)
      .set({ refunded: true, locked: true, payoutAmount: 0 })
      .where(eq(bets.id, betId));
    await tx.insert(bankrollLedger).values({
      kind: "bet_refund",
      participantId: b.bettorId,
      battleId: b.battleId,
      betId: b.id,
      delta: b.stakeAmount,
      reason: "Admin refund",
      byUserId,
    });
  });
}
