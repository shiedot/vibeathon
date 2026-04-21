import { and, eq, sum } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bankrollLedger,
  bets,
  battles,
  participants,
  prizeLedger,
} from "@/db/schema";

const FOUNDER_PRIZE_TAKA = 140_000;
const RUNNER_UP_TAKA = 80_000;
const TOP_SCOUT_TAKA = 50_000;
const BEST_COACH_TAKA = 10_000;
const PARTICIPATION_FLOOR_TAKA = 200;

export type SettleOptions = {
  bestCoachParticipantId?: string | null;
};

export type SettlementRow = {
  participantId: string;
  name: string;
  email: string;
  bankrollTaka: number;
  consolationTaka: number;
  betWinningsTaka: number;
  namedPrizeTaka: number;
  namedPrizeType: string | null;
  participationFloorTaka: number;
  totalTaka: number;
};

async function sumLedger(participantId: string, kind: string): Promise<number> {
  const rows = await db
    .select({ s: sum(bankrollLedger.delta) })
    .from(bankrollLedger)
    .where(
      and(
        eq(bankrollLedger.participantId, participantId),
        eq(bankrollLedger.kind, kind as "seed"),
      ),
    );
  return Number(rows[0]?.s ?? 0);
}

async function findGrandChampionCaptain(): Promise<string | null> {
  const finals = await db
    .select({ winnerTeamId: battles.winnerTeamId })
    .from(battles)
    .where(and(eq(battles.roundNumber, 6), eq(battles.status, "resolved")));
  if (finals.length === 0 || !finals[0].winnerTeamId) return null;
  const { teams } = await import("@/db/schema");
  const [team] = await db
    .select({ captainId: teams.captainId })
    .from(teams)
    .where(eq(teams.id, finals[0].winnerTeamId))
    .limit(1);
  return team?.captainId ?? null;
}

async function findRunnerUpCaptain(): Promise<string | null> {
  const { teams } = await import("@/db/schema");
  const [final] = await db
    .select()
    .from(battles)
    .where(and(eq(battles.roundNumber, 6), eq(battles.status, "resolved")))
    .limit(1);
  if (!final || !final.winnerTeamId) return null;
  const loserTeamId =
    final.winnerTeamId === final.teamAId ? final.teamBId : final.teamAId;
  const loserSnapshot = final.preResolveSnapshot;
  if (loserSnapshot) {
    return final.winnerTeamId === final.teamAId
      ? loserSnapshot.teamBCaptain
      : loserSnapshot.teamACaptain;
  }
  // fallback: current captain of the losing team record.
  const [row] = await db
    .select({ captainId: teams.captainId })
    .from(teams)
    .where(eq(teams.id, loserTeamId))
    .limit(1);
  return row?.captainId ?? null;
}

async function findTopScout(): Promise<string | null> {
  // % growth from bet activity only.
  const rows = await db
    .select({
      participantId: participants.id,
      personalBankroll: participants.personalBankroll,
    })
    .from(participants)
    .where(eq(participants.role, "participant"));
  let winner: { id: string; growth: number } | null = null;
  for (const r of rows) {
    const placed = Number(
      (
        await db
          .select({ s: sum(bets.stakeAmount) })
          .from(bets)
          .where(eq(bets.bettorId, r.participantId))
      )[0]?.s ?? 0,
    );
    if (placed <= 0) continue;
    const payouts = Number(
      (
        await db
          .select({ s: sum(bankrollLedger.delta) })
          .from(bankrollLedger)
          .where(
            and(
              eq(bankrollLedger.participantId, r.participantId),
              eq(bankrollLedger.kind, "bet_payout"),
            ),
          )
      )[0]?.s ?? 0,
    );
    const growth = (payouts - placed) / placed;
    if (!winner || growth > winner.growth) {
      winner = { id: r.participantId, growth };
    }
  }
  return winner?.id ?? null;
}

export async function computeSettlement(
  opts: SettleOptions = {},
): Promise<SettlementRow[]> {
  const rows = await db
    .select({
      id: participants.id,
      name: participants.name,
      email: participants.email,
      bankroll: participants.personalBankroll,
      role: participants.role,
    })
    .from(participants);

  const grandChampion = await findGrandChampionCaptain();
  const runnerUp = await findRunnerUpCaptain();
  const topScout = await findTopScout();

  const out: SettlementRow[] = [];
  for (const r of rows) {
    if (r.role !== "participant") continue;

    const consolation = await sumLedger(r.id, "consol");
    const betWins = await sumLedger(r.id, "bet_payout");
    const betPlace = await sumLedger(r.id, "bet_place");
    const netBetWinnings = betWins + betPlace; // place is negative

    let namedPrizeTaka = 0;
    let namedPrizeType: string | null = null;
    if (r.id === grandChampion) {
      namedPrizeTaka = FOUNDER_PRIZE_TAKA;
      namedPrizeType = "founder";
    } else if (r.id === runnerUp) {
      namedPrizeTaka = RUNNER_UP_TAKA;
      namedPrizeType = "runner_up";
    } else if (r.id === topScout) {
      namedPrizeTaka = TOP_SCOUT_TAKA;
      namedPrizeType = "top_scout";
    } else if (
      opts.bestCoachParticipantId &&
      r.id === opts.bestCoachParticipantId
    ) {
      namedPrizeTaka = BEST_COACH_TAKA;
      namedPrizeType = "best_coach";
    }

    const total =
      r.bankroll +
      consolation +
      Math.max(0, netBetWinnings) +
      namedPrizeTaka +
      PARTICIPATION_FLOOR_TAKA;

    out.push({
      participantId: r.id,
      name: r.name,
      email: r.email,
      bankrollTaka: r.bankroll,
      consolationTaka: consolation,
      betWinningsTaka: Math.max(0, netBetWinnings),
      namedPrizeTaka,
      namedPrizeType,
      participationFloorTaka: PARTICIPATION_FLOOR_TAKA,
      totalTaka: total,
    });
  }
  return out.sort((a, b) => b.totalTaka - a.totalTaka);
}

export async function commitSettlement(opts: SettleOptions = {}) {
  const rows = await computeSettlement(opts);
  await db.transaction(async (tx) => {
    await tx.delete(prizeLedger);
    for (const r of rows) {
      await tx.insert(prizeLedger).values({
        participantId: r.participantId,
        bankrollTaka: r.bankrollTaka,
        consolationTaka: r.consolationTaka,
        betWinningsTaka: r.betWinningsTaka,
        namedPrizeTaka: r.namedPrizeTaka,
        namedPrizeType: r.namedPrizeType as never,
        participationFloorTaka: r.participationFloorTaka,
        totalTaka: r.totalTaka,
        settledAt: new Date(),
      });
    }
  });
  return rows;
}

export function settlementToCsv(rows: SettlementRow[]): string {
  const header = [
    "participant_id",
    "name",
    "email",
    "bankroll_taka",
    "consolation_taka",
    "bet_winnings_taka",
    "named_prize_taka",
    "named_prize_type",
    "participation_floor_taka",
    "total_taka",
  ].join(",");
  const body = rows
    .map((r) =>
      [
        r.participantId,
        JSON.stringify(r.name),
        r.email,
        r.bankrollTaka,
        r.consolationTaka,
        r.betWinningsTaka,
        r.namedPrizeTaka,
        r.namedPrizeType ?? "",
        r.participationFloorTaka,
        r.totalTaka,
      ].join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}
