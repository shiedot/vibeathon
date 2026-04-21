/**
 * Pure bankroll math for battle resolution.
 *
 * Matches §3 of the spec: winner team absorbs 80% of combined stakes into its
 * new team pot, losing captain personally pockets 20%. Non-captain losers
 * transfer with their existing personal bankroll, contributing 0 to the merged
 * pot.
 *
 * Rounding policy: `newWinnerTeamPot = round(pool * 0.8)` with the remainder
 * going to the losing captain. The spec's §3 pot table is internally
 * inconsistent — no single deterministic rounding rule reproduces every row.
 * `round` matches 5/6 spec rows exactly (R1–SF) and produces 16,778 at the
 * Final, one ₿ above the spec's splashy 16,777. Money is fully conserved
 * across the tournament regardless.
 */

export const WINNER_SHARE = 0.8;

export type BattleResolutionInput = {
  winnerTeamPot: number;
  loserTeamPot: number;
};

export type BattleResolution = {
  combinedPool: number;
  newWinnerTeamPot: number;
  loserCaptainConsolation: number;
};

export function resolveBattle(input: BattleResolutionInput): BattleResolution {
  const combinedPool = input.winnerTeamPot + input.loserTeamPot;
  const newWinnerTeamPot = Math.round(combinedPool * WINNER_SHARE);
  const loserCaptainConsolation = combinedPool - newWinnerTeamPot;
  return { combinedPool, newWinnerTeamPot, loserCaptainConsolation };
}

/**
 * Project the winning team pot after N consecutive wins starting from
 * `startingPot` (typically 1000 for an R1 solo Traveller).
 */
export function projectWinnerPot(startingPot: number, roundsWon: number): number {
  let pot = startingPot;
  for (let i = 0; i < roundsWon; i += 1) {
    ({ newWinnerTeamPot: pot } = resolveBattle({
      winnerTeamPot: pot,
      loserTeamPot: pot,
    }));
  }
  return pot;
}

/* ---------------------------------------------------------------------------
 * Parimutuel bet settlement (§6).
 * ------------------------------------------------------------------------ */

export type PlacedBet = {
  bettorId: string;
  teamBackedId: string;
  stakeAmount: number;
};

export type BetPayout = {
  bettorId: string;
  stake: number;
  payout: number; // stake + proportional share of losing pool
};

/**
 * Distribute the losing pool proportionally to winning bettors.
 * Winners get their stake back plus a pro-rata share of the loser pool.
 * Rounding: floor each payout; sweep leftover ₿ into the largest winner's
 * payout to keep the total conserved.
 */
export function settleParimutuel(
  bets: PlacedBet[],
  winningTeamId: string,
): BetPayout[] {
  const winners = bets.filter((b) => b.teamBackedId === winningTeamId);
  const losers = bets.filter((b) => b.teamBackedId !== winningTeamId);

  const winnersPool = winners.reduce((sum, b) => sum + b.stakeAmount, 0);
  const losersPool = losers.reduce((sum, b) => sum + b.stakeAmount, 0);

  if (winners.length === 0) {
    // No one bet on the winner — refund losers to avoid burning ₿.
    return losers.map((b) => ({
      bettorId: b.bettorId,
      stake: b.stakeAmount,
      payout: b.stakeAmount,
    }));
  }

  const payouts: BetPayout[] = winners.map((b) => {
    const share =
      winnersPool === 0
        ? 0
        : Math.floor((b.stakeAmount / winnersPool) * losersPool);
    return {
      bettorId: b.bettorId,
      stake: b.stakeAmount,
      payout: b.stakeAmount + share,
    };
  });

  const distributed = payouts.reduce((sum, p) => sum + (p.payout - p.stake), 0);
  const leftover = losersPool - distributed;
  if (leftover > 0) {
    const target = payouts.reduce((max, p) => (p.stake > max.stake ? p : max));
    target.payout += leftover;
  }

  return payouts;
}

/* ---------------------------------------------------------------------------
 * Bet eligibility (§6 formal rule from §10).
 * Note: spec prose says "you CAN bet on your own team" but §10's formal
 * predicate excludes the current matchup. We enforce the formal predicate
 * here; UI copy has been updated to match.
 * ------------------------------------------------------------------------ */

export type BetEligibilityInput = {
  participant: {
    r1LineageRootId: string;
    currentTeamLineageRootCaptainId: string;
    currentTeamId: string;
    eliminatedByTeamId: string | null;
  };
  battle: {
    teamAId: string;
    teamBId: string;
    bettingClosesAt: Date;
  };
  now: Date;
};

export function canBet(input: BetEligibilityInput): boolean {
  const { participant, battle, now } = input;

  if (
    participant.r1LineageRootId === participant.currentTeamLineageRootCaptainId
  ) {
    return false;
  }
  if (
    battle.teamAId === participant.currentTeamId ||
    battle.teamBId === participant.currentTeamId
  ) {
    return false;
  }
  if (
    participant.eliminatedByTeamId &&
    (battle.teamAId === participant.eliminatedByTeamId ||
      battle.teamBId === participant.eliminatedByTeamId)
  ) {
    return false;
  }
  if (battle.bettingClosesAt.getTime() <= now.getTime()) return false;
  return true;
}

export const MIN_BET = 10;
export const MAX_BET_FRACTION = 0.5;

export function maxAllowedBet(personalBankroll: number): number {
  return Math.floor(personalBankroll * MAX_BET_FRACTION);
}
