/**
 * Pure bankroll math for battle resolution.
 *
 * Matches §3 of the spec: winner team absorbs 80% of combined stakes into its
 * new team pot, losing captain personally pockets 20%. Non-captain losers
 * transfer with their existing personal bankroll, contributing 0 to the merged
 * pot.
 */

export const WINNER_SHARE = 0.8;
export const LOSER_CAPTAIN_SHARE = 0.2;

export type BattleResolutionInput = {
  winnerTeamPot: number;
  loserTeamPot: number;
};

export type BattleResolution = {
  combinedPool: number;
  newWinnerTeamPot: number;
  loserCaptainConsolation: number;
};

/**
 * Resolve a battle's monetary outcome. All amounts are integer ₿; rounding
 * favours the winning team (floor the consolation, give the remainder to the
 * pot) so money is conserved across the tournament.
 */
export function resolveBattle(input: BattleResolutionInput): BattleResolution {
  const combinedPool = input.winnerTeamPot + input.loserTeamPot;
  const loserCaptainConsolation = Math.floor(combinedPool * LOSER_CAPTAIN_SHARE);
  const newWinnerTeamPot = combinedPool - loserCaptainConsolation;
  return { combinedPool, newWinnerTeamPot, loserCaptainConsolation };
}

/**
 * Project the winning team pot after N consecutive wins starting from
 * `startingPot` (typically 1000 for an R1 solo Traveller).
 * Useful for UI projections and tests.
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
    // Edge case: no one bet on the winner. Refund losers to avoid burning ₿.
    return losers.map((b) => ({
      bettorId: b.bettorId,
      stake: b.stakeAmount,
      payout: b.stakeAmount,
    }));
  }

  const payouts: BetPayout[] = winners.map((b) => {
    const share = winnersPool === 0 ? 0 : Math.floor((b.stakeAmount / winnersPool) * losersPool);
    return {
      bettorId: b.bettorId,
      stake: b.stakeAmount,
      payout: b.stakeAmount + share,
    };
  });

  // Sweep leftover into the largest winner to conserve ₿.
  const distributed = payouts.reduce((sum, p) => sum + (p.payout - p.stake), 0);
  const leftover = losersPool - distributed;
  if (leftover > 0) {
    const target = payouts.reduce((max, p) => (p.stake > max.stake ? p : max));
    target.payout += leftover;
  }

  return payouts;
}

/* ---------------------------------------------------------------------------
 * Bet eligibility check (§6).
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

  // Lineage must be broken — i.e. current team lineage differs from the
  // Traveller's original R1 lineage root.
  if (participant.r1LineageRootId === participant.currentTeamLineageRootCaptainId) {
    return false;
  }

  // Can't bet on your own team's current matchup (either side of it).
  if (
    battle.teamAId === participant.currentTeamId ||
    battle.teamBId === participant.currentTeamId
  ) {
    return false;
  }

  // Can't bet on any matchup involving the team that just eliminated you.
  if (
    participant.eliminatedByTeamId &&
    (battle.teamAId === participant.eliminatedByTeamId ||
      battle.teamBId === participant.eliminatedByTeamId)
  ) {
    return false;
  }

  // Betting window must still be open.
  if (battle.bettingClosesAt.getTime() <= now.getTime()) return false;

  return true;
}
