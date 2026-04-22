/**
 * Pod seeding + R1 matchup generation (§9).
 *
 * Score = yearsCoding + comfortLevel + shippingConfidence. Rank 1..N desc
 * by score (ties broken by name for determinism). Snake-draft into 8 pods of 8
 * so the top-8 each seed a separate pod and the bottom-8 sit at the bottom of
 * their respective pods.
 *
 * R1 matchups are deterministic: within each pod sorted by score desc, pair
 * the top seed vs the bottom seed (1v8, 2v7, 3v6, 4v5). This mirrors a
 * classic bracket fold and maximises the spread within each R1 match. The
 * admin can override any matchup in the pods UI.
 */

export type RosterEntry = {
  id: string;
  name: string;
  department: string;
  preferredPitchLanguage: "english" | "bangla" | "either";
  experienceScore: number;
};

export type PodAssignment = {
  podId: number;
  members: RosterEntry[];
};

export type R1MatchupPreview = {
  podId: number;
  teamA: RosterEntry;
  teamB: RosterEntry;
};

export type SeedingResult = {
  pods: PodAssignment[];
  r1Matchups: R1MatchupPreview[];
};

/**
 * Score formula per product spec. Each input is summed directly — this keeps
 * the math legible for admins eyeballing the ranking table.
 *
 * - yearsCoding: integer 0..N (non-integer inputs like 4.5 are rounded down)
 * - comfortLevel: 1..4 (Never Before → Can Teach Others)
 * - shippingConfidence: 1..5 self-rated
 */
export function experienceScore(
  yearsCoding: number,
  comfortLevel: number,
  shippingConfidence: number,
) {
  return (
    Math.floor(Number(yearsCoding) || 0) +
    (Number(comfortLevel) || 0) +
    (Number(shippingConfidence) || 0)
  );
}

function rankedByScore(roster: RosterEntry[]): RosterEntry[] {
  return roster.slice().sort((a, b) => {
    if (b.experienceScore !== a.experienceScore) {
      return b.experienceScore - a.experienceScore;
    }
    // Deterministic tiebreak: name, then id.
    const n = a.name.localeCompare(b.name);
    if (n !== 0) return n;
    return a.id.localeCompare(b.id);
  });
}

export function snakeDraftPods(
  roster: RosterEntry[],
  podCount = 8,
): PodAssignment[] {
  const sorted = rankedByScore(roster);
  const pods: RosterEntry[][] = Array.from({ length: podCount }, () => []);

  sorted.forEach((entry, idx) => {
    const row = Math.floor(idx / podCount);
    const col = idx % podCount;
    const podIndex = row % 2 === 0 ? col : podCount - 1 - col;
    pods[podIndex].push(entry);
  });

  return pods.map((members, i) => ({ podId: i + 1, members }));
}

/**
 * Top-vs-bottom pairing within a pod. Members are sorted score-desc, then
 * the top seed plays the bottom seed (0 vs N-1), second-top plays
 * second-bottom (1 vs N-2), and so on. For an 8-pod: 1v8, 2v7, 3v6, 4v5.
 *
 * Concretely, in a 64-roster where pod 1 holds global seeds
 * {1, 16, 17, 32, 33, 48, 49, 64}, this yields:
 *   #1 vs #64, #16 vs #49, #17 vs #48, #32 vs #33.
 */
function topBottomPairs(members: RosterEntry[]): [RosterEntry, RosterEntry][] {
  if (members.length % 2 !== 0) {
    throw new Error(
      `topBottomPairs requires even count, got ${members.length}`,
    );
  }
  const ordered = members.slice().sort((a, b) => {
    if (b.experienceScore !== a.experienceScore) {
      return b.experienceScore - a.experienceScore;
    }
    const n = a.name.localeCompare(b.name);
    if (n !== 0) return n;
    return a.id.localeCompare(b.id);
  });
  const out: [RosterEntry, RosterEntry][] = [];
  const half = ordered.length / 2;
  for (let i = 0; i < half; i += 1) {
    out.push([ordered[i], ordered[ordered.length - 1 - i]]);
  }
  return out;
}

export function generateR1Matchups(pods: PodAssignment[]): R1MatchupPreview[] {
  const out: R1MatchupPreview[] = [];
  for (const pod of pods) {
    const pairs = topBottomPairs(pod.members);
    for (const [a, b] of pairs) {
      out.push({ podId: pod.podId, teamA: a, teamB: b });
    }
  }
  return out;
}

export function seedTournament(
  roster: RosterEntry[],
  podCount = 8,
): SeedingResult {
  const pods = snakeDraftPods(roster, podCount);
  const r1 = generateR1Matchups(pods);
  return { pods, r1Matchups: r1 };
}
