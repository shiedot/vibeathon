import { and, desc, eq, isNull, or, sql, sum } from "drizzle-orm";
// Extracted below: audit only counts open stakes where payout hasn't been
// resolved yet — any settled bet is already reflected in personalBankroll.
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
} from "@/db/schema";
import { canBet } from "@/lib/bankroll";
import { evaluateConsensus, tallyVotes } from "@/lib/voting";

export type MeState = {
  participant: {
    id: string;
    name: string;
    email: string;
    role: "participant" | "organizer" | "judge";
    personalBankroll: number;
    currentTeamId: string | null;
    eliminatedByTeamId: string | null;
    r1LineageRootId: string | null;
  };
  team: {
    id: string;
    displayName: string | null;
    podId: number | null;
    currentRound: number;
    captainId: string;
    teamPot: number;
    members: { id: string; name: string }[];
    isCaptain: boolean;
  } | null;
  currentBattle: {
    id: string;
    roundNumber: number;
    status: string;
    teamAId: string;
    teamBId: string;
    myTeamId: string | null;
    opponentTeamId: string | null;
    bettingClosesAt: string;
    actualStart: string | null;
    canVote: boolean;
    myVote: string | null;
    tally: { teamA: number; teamB: number; needed: number; remaining: number };
  } | null;
  /**
   * Highest-priority un-acknowledged celebration for this participant. The
   * client compares `key` against localStorage to ensure each celebration
   * fires exactly once per browser.
   *
   * Priority (top wins):
   *   1. Settlement named prize (grand_champion / runner_up / top_scout /
   *      best_coach) — emitted the moment `prize_ledger` is committed.
   *   2. Settlement participation floor — emitted once per participant.
   *   3. Grand Champion battle win (final battle, user was captain of the
   *      winning team) — emitted even before settlement commits.
   *   4. Runner-Up battle loss (final battle, user was captain of the losing
   *      team).
   *   5. Regular battle win.
   */
  celebration: {
    key: string;
    variant:
      | "battle_win"
      | "grand_champion"
      | "runner_up"
      | "top_scout"
      | "best_coach"
      | "participation";
    name: string;
    headline: string;
    subheadline: string;
  } | null;
};

export async function getMeState(participantId: string): Promise<MeState> {
  const [p] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1);
  if (!p) throw new Error("Participant not found");

  let team: MeState["team"] = null;
  if (p.currentTeamId) {
    const [t] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, p.currentTeamId))
      .limit(1);
    if (t) {
      const members = await db
        .select({
          id: participants.id,
          name: participants.name,
        })
        .from(teamMembers)
        .innerJoin(
          participants,
          eq(participants.id, teamMembers.participantId),
        )
        .where(
          and(eq(teamMembers.teamId, t.id), isNull(teamMembers.leftAt)),
        );
      team = {
        id: t.id,
        displayName: t.displayName,
        podId: t.podId ?? null,
        currentRound: t.currentRound,
        captainId: t.captainId,
        teamPot: t.teamPot,
        members,
        isCaptain: t.captainId === p.id,
      };
    }
  }

  let currentBattle: MeState["currentBattle"] = null;
  if (team) {
    const [battle] = await db
      .select()
      .from(battles)
      .where(
        and(
          or(eq(battles.teamAId, team.id), eq(battles.teamBId, team.id)),
          or(eq(battles.status, "voting"), eq(battles.status, "pending"), eq(battles.status, "deadlocked")),
        ),
      )
      .orderBy(desc(battles.createdAt))
      .limit(1);
    if (battle) {
      const myTeamId = battle.teamAId === team.id ? team.id : team.id;
      const opponent = battle.teamAId === team.id ? battle.teamBId : battle.teamAId;

      const votes = await db
        .select({
          voterId: consensusVotes.voterId,
          teamVotedForId: consensusVotes.teamVotedForId,
        })
        .from(consensusVotes)
        .where(eq(consensusVotes.battleId, battle.id));

      const myVote = votes.find((v) => v.voterId === p.id)?.teamVotedForId ?? null;

      const [a, b] = await Promise.all([
        db
          .select({ c: sql<number>`count(*)` })
          .from(teamMembers)
          .where(
            and(eq(teamMembers.teamId, battle.teamAId), isNull(teamMembers.leftAt)),
          ),
        db
          .select({ c: sql<number>`count(*)` })
          .from(teamMembers)
          .where(
            and(eq(teamMembers.teamId, battle.teamBId), isNull(teamMembers.leftAt)),
          ),
      ]);

      const tally = tallyVotes({
        teamAVoterCount: Number(a[0]?.c ?? 0),
        teamBVoterCount: Number(b[0]?.c ?? 0),
        teamAId: battle.teamAId,
        teamBId: battle.teamBId,
        votes,
        judgeVotes: battle.judgeVotes,
      });
      const outcome = evaluateConsensus(tally);

      currentBattle = {
        id: battle.id,
        roundNumber: battle.roundNumber,
        status: battle.status,
        teamAId: battle.teamAId,
        teamBId: battle.teamBId,
        myTeamId,
        opponentTeamId: opponent,
        bettingClosesAt: battle.bettingClosesAt.toISOString(),
        actualStart: battle.actualStart?.toISOString() ?? null,
        canVote: battle.status === "voting" && myVote == null,
        myVote,
        tally: {
          teamA: tally.teamA,
          teamB: tally.teamB,
          needed: Math.floor(tally.totalVoters / 2) + 1,
          remaining: tally.remaining,
        },
      };
      void outcome;
    }
  }

  const celebration = await findCelebration(p.id, p.name);

  return {
    participant: {
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      personalBankroll: p.personalBankroll,
      currentTeamId: p.currentTeamId,
      eliminatedByTeamId: p.eliminatedByTeamId,
      r1LineageRootId: p.r1LineageRootId,
    },
    team,
    currentBattle,
    celebration,
  };
}

const ROUND_LABEL: Record<number, string> = {
  1: "Round 1",
  2: "Round 2",
  3: "Round 3",
  4: "Quarterfinal",
  5: "Semifinal",
  6: "Grand Final",
};

/**
 * Resolve the highest-priority celebration for a participant. Returns null
 * when there is nothing to celebrate.
 */
async function findCelebration(
  participantId: string,
  name: string,
): Promise<MeState["celebration"]> {
  // --- 1. Settlement prize (named) + 2. participation floor ---
  const [prize] = await db
    .select()
    .from(prizeLedger)
    .where(eq(prizeLedger.participantId, participantId))
    .orderBy(desc(prizeLedger.createdAt))
    .limit(1);

  if (prize) {
    if (prize.namedPrizeType === "founder") {
      return {
        key: `prize:${prize.id}:founder`,
        variant: "grand_champion",
        name,
        headline: "Grand Champion",
        subheadline: `The only Traveller who never lost. ₿${prize.namedPrizeTaka.toLocaleString()}`,
      };
    }
    if (prize.namedPrizeType === "runner_up") {
      return {
        key: `prize:${prize.id}:runner_up`,
        variant: "runner_up",
        name,
        headline: "Runner-Up Founder",
        subheadline: `₿${prize.namedPrizeTaka.toLocaleString()} for carrying the losing Final captain slot.`,
      };
    }
    if (prize.namedPrizeType === "top_scout") {
      return {
        key: `prize:${prize.id}:top_scout`,
        variant: "top_scout",
        name,
        headline: "Top Scout",
        subheadline: `Biggest % bankroll growth. ₿${prize.namedPrizeTaka.toLocaleString()}`,
      };
    }
    if (prize.namedPrizeType === "best_coach") {
      return {
        key: `prize:${prize.id}:best_coach`,
        variant: "best_coach",
        name,
        headline: "Best Coach",
        subheadline: `Judges' choice. ₿${prize.namedPrizeTaka.toLocaleString()}`,
      };
    }
    // No named prize — fall back to the participation floor once.
    if (prize.participationFloorTaka > 0) {
      return {
        key: `prize:${prize.id}:participation`,
        variant: "participation",
        name,
        headline: "You walk away with something",
        subheadline: `Participation floor · ₿${prize.participationFloorTaka.toLocaleString()}`,
      };
    }
  }

  // --- 3-5. Most recent resolved battle the user was in ---
  // `preResolveSnapshot` is the source of truth for who was where at resolve
  // time. Look back at the last ~16 resolved battles (plenty given 8 pods x 8
  // battles per round), then filter in JS — SQL JSON membership operators are
  // awkward to express in Drizzle.
  const recent = await db
    .select({
      id: battles.id,
      roundNumber: battles.roundNumber,
      teamAId: battles.teamAId,
      teamBId: battles.teamBId,
      winnerTeamId: battles.winnerTeamId,
      preResolveSnapshot: battles.preResolveSnapshot,
      actualEnd: battles.actualEnd,
    })
    .from(battles)
    .where(eq(battles.status, "resolved"))
    .orderBy(desc(battles.actualEnd))
    .limit(16);

  for (const b of recent) {
    const snap = b.preResolveSnapshot;
    if (!snap || !b.winnerTeamId) continue;
    const onA = snap.teamAMembers.includes(participantId);
    const onB = snap.teamBMembers.includes(participantId);
    if (!onA && !onB) continue;

    const myTeamId = onA ? b.teamAId : b.teamBId;
    const won = myTeamId === b.winnerTeamId;
    const wasCaptain =
      (onA && snap.teamACaptain === participantId) ||
      (onB && snap.teamBCaptain === participantId);
    const roundLabel = ROUND_LABEL[b.roundNumber] ?? `Round ${b.roundNumber}`;

    if (won) {
      if (b.roundNumber === 6 && wasCaptain) {
        return {
          key: `battle:${b.id}:grand_champion`,
          variant: "grand_champion",
          name,
          headline: "Grand Champion",
          subheadline: "You never lost. The Final is yours.",
        };
      }
      return {
        key: `battle:${b.id}:win`,
        variant: "battle_win",
        name,
        headline: `${roundLabel} — you won`,
        subheadline: "Your team takes 80% of the combined pool.",
      };
    }

    // Final loser who was captain → runner-up celebration.
    if (b.roundNumber === 6 && wasCaptain) {
      return {
        key: `battle:${b.id}:runner_up`,
        variant: "runner_up",
        name,
        headline: "Runner-Up Founder",
        subheadline: "Captain of the losing Final team. Still a podium.",
      };
    }

    // Any other loss: no celebration (but we return null so nothing fires).
    return null;
  }

  return null;
}

export type BracketNode = {
  battleId: string;
  roundNumber: number;
  podId: number | null;
  status: string;
  teamA: { id: string; displayName: string | null; pot: number } | null;
  teamB: { id: string; displayName: string | null; pot: number } | null;
  winnerTeamId: string | null;
  bettingClosesAt: string;
  actualStart: string | null;
};

export async function getBracket(): Promise<BracketNode[]> {
  const rows = await db
    .select({
      battleId: battles.id,
      roundNumber: battles.roundNumber,
      status: battles.status,
      teamAId: battles.teamAId,
      teamBId: battles.teamBId,
      winnerTeamId: battles.winnerTeamId,
      bettingClosesAt: battles.bettingClosesAt,
      actualStart: battles.actualStart,
    })
    .from(battles)
    .orderBy(battles.roundNumber, battles.createdAt);
  const teamIds = new Set<string>();
  rows.forEach((r) => {
    teamIds.add(r.teamAId);
    teamIds.add(r.teamBId);
  });
  const teamRows = await db
    .select({
      id: teams.id,
      displayName: teams.displayName,
      pot: teams.teamPot,
      podId: teams.podId,
    })
    .from(teams);
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  return rows.map((r) => {
    const a = teamById.get(r.teamAId);
    const b = teamById.get(r.teamBId);
    return {
      battleId: r.battleId,
      roundNumber: r.roundNumber,
      podId: a?.podId ?? b?.podId ?? null,
      status: r.status,
      teamA: a ? { id: a.id, displayName: a.displayName, pot: a.pot } : null,
      teamB: b ? { id: b.id, displayName: b.displayName, pot: b.pot } : null,
      winnerTeamId: r.winnerTeamId,
      bettingClosesAt: r.bettingClosesAt.toISOString(),
      actualStart: r.actualStart?.toISOString() ?? null,
    };
  });
}

export type BattleStateDetail = {
  id: string;
  roundNumber: number;
  status: string;
  actualStart: string | null;
  bettingClosesAt: string;
  teamA: { id: string; displayName: string | null; pot: number };
  teamB: { id: string; displayName: string | null; pot: number };
  poolA: number;
  poolB: number;
  scoutsA: number;
  scoutsB: number;
  tally: { teamA: number; teamB: number; totalVoters: number; remaining: number };
  winnerTeamId: string | null;
};

export async function getBattleState(
  battleId: string,
): Promise<BattleStateDetail | null> {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, battleId))
    .limit(1);
  if (!battle) return null;
  const teamRows = await db
    .select()
    .from(teams)
    .where(
      or(eq(teams.id, battle.teamAId), eq(teams.id, battle.teamBId)),
    );
  const a = teamRows.find((t) => t.id === battle.teamAId);
  const b = teamRows.find((t) => t.id === battle.teamBId);
  if (!a || !b) return null;

  const poolAStakes = await db
    .select({ stake: sum(bets.stakeAmount) })
    .from(bets)
    .where(
      and(
        eq(bets.battleId, battleId),
        eq(bets.teamBackedId, battle.teamAId),
      ),
    );
  const poolBStakes = await db
    .select({ stake: sum(bets.stakeAmount) })
    .from(bets)
    .where(
      and(
        eq(bets.battleId, battleId),
        eq(bets.teamBackedId, battle.teamBId),
      ),
    );
  const scoutsARows = await db
    .select({ c: sql<number>`count(distinct ${bets.bettorId})` })
    .from(bets)
    .where(
      and(
        eq(bets.battleId, battleId),
        eq(bets.teamBackedId, battle.teamAId),
      ),
    );
  const scoutsBRows = await db
    .select({ c: sql<number>`count(distinct ${bets.bettorId})` })
    .from(bets)
    .where(
      and(
        eq(bets.battleId, battleId),
        eq(bets.teamBackedId, battle.teamBId),
      ),
    );

  const aMembers = await db
    .select({ c: sql<number>`count(*)` })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, battle.teamAId), isNull(teamMembers.leftAt)));
  const bMembers = await db
    .select({ c: sql<number>`count(*)` })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, battle.teamBId), isNull(teamMembers.leftAt)));
  const votes = await db
    .select({ teamVotedForId: consensusVotes.teamVotedForId })
    .from(consensusVotes)
    .where(eq(consensusVotes.battleId, battleId));

  const tally = tallyVotes({
    teamAVoterCount: Number(aMembers[0]?.c ?? 0),
    teamBVoterCount: Number(bMembers[0]?.c ?? 0),
    teamAId: battle.teamAId,
    teamBId: battle.teamBId,
    votes,
    judgeVotes: battle.judgeVotes,
  });

  return {
    id: battle.id,
    roundNumber: battle.roundNumber,
    status: battle.status,
    actualStart: battle.actualStart?.toISOString() ?? null,
    bettingClosesAt: battle.bettingClosesAt.toISOString(),
    teamA: { id: a.id, displayName: a.displayName, pot: a.teamPot },
    teamB: { id: b.id, displayName: b.displayName, pot: b.teamPot },
    poolA: Number(poolAStakes[0]?.stake ?? 0),
    poolB: Number(poolBStakes[0]?.stake ?? 0),
    scoutsA: Number(scoutsARows[0]?.c ?? 0),
    scoutsB: Number(scoutsBRows[0]?.c ?? 0),
    tally: {
      teamA: tally.teamA,
      teamB: tally.teamB,
      totalVoters: tally.totalVoters,
      remaining: tally.remaining,
    },
    winnerTeamId: battle.winnerTeamId,
  };
}

export type Leaderboards = {
  topBankrolls: { id: string; name: string; amount: number }[];
  topTeamPots: { id: string; name: string | null; amount: number }[];
  topScouts: { id: string; name: string; growthPct: number; netTaka: number }[];
};

export async function getLeaderboards(): Promise<Leaderboards> {
  const bankrolls = await db
    .select({
      id: participants.id,
      name: participants.name,
      amount: participants.personalBankroll,
    })
    .from(participants)
    .where(eq(participants.role, "participant"))
    .orderBy(desc(participants.personalBankroll))
    .limit(10);

  const pots = await db
    .select({
      id: teams.id,
      name: teams.displayName,
      amount: teams.teamPot,
    })
    .from(teams)
    .where(eq(teams.isActive, true))
    .orderBy(desc(teams.teamPot))
    .limit(10);

  // Top scouts by net bet winnings vs total placed.
  const scouts = await db
    .select({
      id: participants.id,
      name: participants.name,
    })
    .from(participants)
    .where(eq(participants.role, "participant"));

  const scoutStats: { id: string; name: string; growthPct: number; netTaka: number }[] = [];
  for (const s of scouts) {
    const placed = Number(
      (
        await db
          .select({ s: sum(bets.stakeAmount) })
          .from(bets)
          .where(eq(bets.bettorId, s.id))
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
              eq(bankrollLedger.participantId, s.id),
              eq(bankrollLedger.kind, "bet_payout"),
            ),
          )
      )[0]?.s ?? 0,
    );
    const net = payouts - placed;
    scoutStats.push({
      id: s.id,
      name: s.name,
      growthPct: (net / placed) * 100,
      netTaka: net,
    });
  }
  scoutStats.sort((a, b) => b.growthPct - a.growthPct);

  return {
    topBankrolls: bankrolls,
    topTeamPots: pots,
    topScouts: scoutStats.slice(0, 10),
  };
}

export type AuditState = {
  totals: { personalBankrolls: number; teamPots: number; openBetStakes: number };
  ledgerByKind: { kind: string; sum: number }[];
  conservation: {
    expected: number;
    actual: number;
    deltaFromExpected: number;
  };
};

export async function getAuditState(): Promise<AuditState> {
  const [pb] = await db
    .select({ s: sum(participants.personalBankroll) })
    .from(participants);
  const [tp] = await db
    .select({ s: sum(teams.teamPot) })
    .from(teams);
  // Only count bets that haven't paid out yet — settled payouts are already
  // reflected in participants.personalBankroll.
  const [ob] = await db
    .select({ s: sum(bets.stakeAmount) })
    .from(bets)
    .where(and(eq(bets.refunded, false), isNull(bets.payoutAmount)));

  const ledgerRows = await db
    .select({ kind: bankrollLedger.kind, s: sum(bankrollLedger.delta) })
    .from(bankrollLedger)
    .groupBy(bankrollLedger.kind);

  // Conservation expected: 1000 ₿ × participants + organizer bonuses (mentor/learner)
  const [participantCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(participants)
    .where(eq(participants.role, "participant"));
  const [mentorTotal] = await db
    .select({ s: sum(participants.mentorHonorBonus) })
    .from(participants);
  const [learnerTotal] = await db
    .select({ s: sum(participants.learnerBankroll) })
    .from(participants);

  const expected =
    Number(participantCount?.c ?? 0) * 1000 +
    Number(mentorTotal?.s ?? 0) +
    Number(learnerTotal?.s ?? 0);

  const totals = {
    personalBankrolls: Number(pb?.s ?? 0),
    teamPots: Number(tp?.s ?? 0),
    openBetStakes: Number(ob?.s ?? 0),
  };
  const actual = totals.personalBankrolls + totals.teamPots + totals.openBetStakes;
  return {
    totals,
    ledgerByKind: ledgerRows.map((r) => ({
      kind: r.kind,
      sum: Number(r.s ?? 0),
    })),
    conservation: {
      expected,
      actual,
      deltaFromExpected: actual - expected,
    },
  };
}

export async function getCanBetStatus(
  participantId: string,
  battleId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const [p] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1);
  if (!p) return { allowed: false, reason: "not_found" };

  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, battleId))
    .limit(1);
  if (!battle) return { allowed: false, reason: "no_battle" };

  const [currentTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, p.currentTeamId ?? ""))
    .limit(1);

  const allowed = canBet({
    participant: {
      r1LineageRootId: p.r1LineageRootId ?? "",
      currentTeamLineageRootCaptainId: currentTeam?.lineageRootCaptainId ?? "",
      currentTeamId: p.currentTeamId ?? "",
      eliminatedByTeamId: p.eliminatedByTeamId,
    },
    battle: {
      teamAId: battle.teamAId,
      teamBId: battle.teamBId,
      bettingClosesAt: battle.bettingClosesAt,
    },
    now: new Date(),
  });
  return { allowed };
}
