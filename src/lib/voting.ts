/**
 * Consensus voting math (§5). Simple majority of the combined team decides.
 * For SF/Final, judge votes count equally (1 judge vote = 1 member vote,
 * max 3 judges per matchup).
 */

export type VoteTally = {
  teamA: number;
  teamB: number;
  totalVoters: number;
  castVotes: number;
  remaining: number;
};

export type ConsensusOutcome =
  | { kind: "no_majority_possible"; tally: VoteTally }
  | { kind: "in_progress"; tally: VoteTally }
  | { kind: "majority"; winner: "A" | "B"; tally: VoteTally }
  | { kind: "deadlocked"; tally: VoteTally };

export function tallyVotes(params: {
  teamAVoterCount: number;
  teamBVoterCount: number;
  teamAId: string;
  teamBId: string;
  votes: { teamVotedForId: string }[];
  judgeVotes?: { teamVotedFor: string }[];
}): VoteTally {
  const totalVoters =
    params.teamAVoterCount +
    params.teamBVoterCount +
    (params.judgeVotes?.length ?? 0);
  let a = 0;
  let b = 0;
  for (const v of params.votes) {
    if (v.teamVotedForId === params.teamAId) a += 1;
    else if (v.teamVotedForId === params.teamBId) b += 1;
  }
  for (const jv of params.judgeVotes ?? []) {
    if (jv.teamVotedFor === params.teamAId) a += 1;
    else if (jv.teamVotedFor === params.teamBId) b += 1;
  }
  const castVotes = a + b;
  return {
    teamA: a,
    teamB: b,
    totalVoters,
    castVotes,
    remaining: totalVoters - castVotes,
  };
}

export function evaluateConsensus(tally: VoteTally): ConsensusOutcome {
  const needed = Math.floor(tally.totalVoters / 2) + 1;
  if (tally.teamA >= needed) {
    return { kind: "majority", winner: "A", tally };
  }
  if (tally.teamB >= needed) {
    return { kind: "majority", winner: "B", tally };
  }
  if (tally.remaining === 0) {
    if (tally.teamA === tally.teamB) return { kind: "deadlocked", tally };
    // If everyone voted and still no side has a strict majority (impossible
    // when totals are equal but can happen if voters abstain), treat the
    // side with more votes as the majority holder; tie remains deadlocked.
    if (tally.teamA > tally.teamB) return { kind: "majority", winner: "A", tally };
    return { kind: "majority", winner: "B", tally };
  }
  // Can either side still reach majority?
  const aReachable = tally.teamA + tally.remaining >= needed;
  const bReachable = tally.teamB + tally.remaining >= needed;
  if (!aReachable && !bReachable) return { kind: "deadlocked", tally };
  return { kind: "in_progress", tally };
}
