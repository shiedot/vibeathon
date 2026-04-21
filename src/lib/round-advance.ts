/**
 * Round advancement: given the winners of round N, decide the N+1 matchups.
 *
 * R1→R2 and R2→R3 stay inside a pod. R3→QF pairs pod winners from pods {1,2},
 * {3,4}, {5,6}, {7,8}. QF→SF pairs {QF1 winner, QF2}, {QF3, QF4}.
 * SF→Final pairs the two semifinal winners.
 */

export type RoundWinner = {
  teamId: string;
  podId: number | null;
  battleId: string;
};

export type NextRoundMatchup = {
  roundNumber: number;
  podId: number | null;
  teamAId: string;
  teamBId: string;
};

function pairWithinGroup(
  winners: RoundWinner[],
  nextRound: number,
): NextRoundMatchup[] {
  if (winners.length % 2 !== 0) {
    throw new Error(
      `Cannot pair ${winners.length} winners for round ${nextRound}`,
    );
  }
  const out: NextRoundMatchup[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    out.push({
      roundNumber: nextRound,
      podId: winners[i].podId,
      teamAId: winners[i].teamId,
      teamBId: winners[i + 1].teamId,
    });
  }
  return out;
}

/**
 * For round 4 (QF) we pair pods [1,2] [3,4] [5,6] [7,8].
 * Takes the single pod-winner of each pod (the team that won R3).
 */
function pairPodsForQF(winners: RoundWinner[]): NextRoundMatchup[] {
  const byPod = new Map<number, RoundWinner>();
  for (const w of winners) {
    if (w.podId == null) continue;
    byPod.set(w.podId, w);
  }
  const out: NextRoundMatchup[] = [];
  for (const [a, b] of [
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
  ] as const) {
    const ta = byPod.get(a);
    const tb = byPod.get(b);
    if (!ta || !tb) {
      throw new Error(`Missing pod winner for pod ${!ta ? a : b}`);
    }
    out.push({ roundNumber: 4, podId: null, teamAId: ta.teamId, teamBId: tb.teamId });
  }
  return out;
}

export function advanceRound(
  fromRound: 1 | 2 | 3 | 4 | 5,
  winners: RoundWinner[],
): NextRoundMatchup[] {
  if (fromRound === 1) {
    // Group winners by pod, pair within each pod.
    const byPod = groupBy(winners, (w) => w.podId ?? -1);
    const out: NextRoundMatchup[] = [];
    for (const [, group] of byPod) {
      out.push(...pairWithinGroup(group, 2));
    }
    return out;
  }
  if (fromRound === 2) {
    const byPod = groupBy(winners, (w) => w.podId ?? -1);
    const out: NextRoundMatchup[] = [];
    for (const [, group] of byPod) {
      out.push(...pairWithinGroup(group, 3));
    }
    return out;
  }
  if (fromRound === 3) {
    return pairPodsForQF(winners);
  }
  if (fromRound === 4) {
    return pairWithinGroup(winners, 5);
  }
  // fromRound === 5
  return pairWithinGroup(winners, 6);
}

function groupBy<T, K>(arr: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = keyFn(item);
    const bucket = m.get(k);
    if (bucket) bucket.push(item);
    else m.set(k, [item]);
  }
  return m;
}
