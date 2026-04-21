/**
 * Pod seeding + R1 matchup generation (§9).
 *
 * - Snake-draft 64 → 8 pods of 8 by experience score descending.
 * - Randomize R1 matchups within pods, softly avoiding same-department pairings
 *   and preferring matched pitch-language preferences.
 * - Deterministic with a seeded RNG so organizers can preview + re-run.
 */

export type RosterEntry = {
  id: string;
  name: string;
  department: string;
  preferredPitchLanguage: "english" | "bangla" | "either";
  experienceScore: number; // comfort*2 + min(years,10)
};

export type PodAssignment = {
  podId: number; // 1..8
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

export function experienceScore(comfortLevel: number, yearsCoding: number) {
  return comfortLevel * 2 + Math.min(yearsCoding, 10);
}

/** Mulberry32 - deterministic, small, good-enough RNG. */
export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function snakeDraftPods(
  roster: RosterEntry[],
  podCount = 8,
): PodAssignment[] {
  const sorted = roster
    .slice()
    .sort((a, b) => b.experienceScore - a.experienceScore);
  const pods: RosterEntry[][] = Array.from({ length: podCount }, () => []);

  sorted.forEach((entry, idx) => {
    const row = Math.floor(idx / podCount);
    const col = idx % podCount;
    const podIndex = row % 2 === 0 ? col : podCount - 1 - col;
    pods[podIndex].push(entry);
  });

  return pods.map((members, i) => ({ podId: i + 1, members }));
}

/** Pair an array of entries into 2s, minimising same-department collisions. */
function pairWithinPod(
  members: RosterEntry[],
  rng: () => number,
): [RosterEntry, RosterEntry][] {
  if (members.length % 2 !== 0) {
    throw new Error(`pairWithinPod requires even count, got ${members.length}`);
  }
  const attempts = 64;
  let best: [RosterEntry, RosterEntry][] | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const shuffled = shuffle(members, rng);
    const pairs: [RosterEntry, RosterEntry][] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
    }
    const cost = pairs.reduce((total, [a, b]) => {
      let c = 0;
      if (a.department === b.department) c += 10;
      if (
        a.preferredPitchLanguage !== "either" &&
        b.preferredPitchLanguage !== "either" &&
        a.preferredPitchLanguage !== b.preferredPitchLanguage
      ) {
        c += 1;
      }
      return total + c;
    }, 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = pairs;
      if (cost === 0) break;
    }
  }
  return best!;
}

export function generateR1Matchups(
  pods: PodAssignment[],
  seed = 1,
): R1MatchupPreview[] {
  const rng = mulberry32(seed);
  const out: R1MatchupPreview[] = [];
  for (const pod of pods) {
    const pairs = pairWithinPod(pod.members, rng);
    for (const [a, b] of pairs) {
      out.push({ podId: pod.podId, teamA: a, teamB: b });
    }
  }
  return out;
}

export function seedTournament(
  roster: RosterEntry[],
  seed = 1,
  podCount = 8,
): SeedingResult {
  const pods = snakeDraftPods(roster, podCount);
  const r1 = generateR1Matchups(pods, seed);
  return { pods, r1Matchups: r1 };
}
