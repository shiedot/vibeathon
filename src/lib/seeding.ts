/**
 * Pod seeding + R1 matchup generation (§9).
 *
 * Score = yearsCoding + comfortLevel + shippingConfidence. Rank 1..N desc
 * by score (ties broken by name for determinism). Snake-draft into 8 pods of 8
 * so the top-8 each seed a separate pod and the bottom-8 sit at the bottom of
 * their respective pods.
 *
 * R1 matchups are deterministic: within each pod sorted by score desc, pair
 * adjacent seeds (1v2, 3v4, 5v6, 7v8) for balanced matches. This is
 * overridable by the admin in the pods UI.
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
 * Adjacent-seed pairing within a pod. Members are already snake-drafted in
 * seed order (top member first), so 1v2 / 3v4 / ... yields the most balanced
 * R1 matches possible given the pod composition.
 */
function adjacentPairs(members: RosterEntry[]): [RosterEntry, RosterEntry][] {
  if (members.length % 2 !== 0) {
    throw new Error(
      `adjacentPairs requires even count, got ${members.length}`,
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
  for (let i = 0; i < ordered.length; i += 2) {
    out.push([ordered[i], ordered[i + 1]]);
  }
  return out;
}

export function generateR1Matchups(pods: PodAssignment[]): R1MatchupPreview[] {
  const out: R1MatchupPreview[] = [];
  for (const pod of pods) {
    const pairs = adjacentPairs(pod.members);
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
