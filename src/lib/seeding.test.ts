import { describe, expect, it } from "vitest";
import {
  experienceScore,
  generateR1Matchups,
  seedTournament,
  snakeDraftPods,
  type RosterEntry,
} from "./seeding";

function mkRoster(n: number): RosterEntry[] {
  const roster: RosterEntry[] = [];
  for (let i = 0; i < n; i += 1) {
    roster.push({
      id: `p${String(i).padStart(3, "0")}`,
      name: `Person ${String(i).padStart(3, "0")}`,
      department: `Dept ${i % 5}`,
      preferredPitchLanguage: (["english", "bangla", "either"] as const)[i % 3],
      experienceScore: experienceScore(i % 12, (i % 4) + 1, (i % 5) + 1),
    });
  }
  return roster;
}

describe("experienceScore", () => {
  it("sums years + comfort + confidence", () => {
    expect(experienceScore(5, 3, 4)).toBe(12);
  });
  it("floors fractional years and coerces non-numbers", () => {
    expect(experienceScore(4.6, 3, 4)).toBe(11);
    expect(experienceScore(Number.NaN, 3, 4)).toBe(7);
  });
});

describe("snakeDraftPods", () => {
  it("produces 8 pods of 8 from a 64-roster", () => {
    const pods = snakeDraftPods(mkRoster(64), 8);
    expect(pods).toHaveLength(8);
    expect(pods.every((p) => p.members.length === 8)).toBe(true);
  });

  it("places the highest-exp player in pod 1, next in pod 2", () => {
    const roster = mkRoster(16);
    const pods = snakeDraftPods(roster, 8);
    const sorted = roster
      .slice()
      .sort((a, b) => b.experienceScore - a.experienceScore);
    expect(pods[0].members[0].id).toBe(sorted[0].id);
    expect(pods[1].members[0].id).toBe(sorted[1].id);
  });

  it("is deterministic across runs (no RNG)", () => {
    const a = snakeDraftPods(mkRoster(64), 8);
    const b = snakeDraftPods(mkRoster(64), 8);
    expect(a).toEqual(b);
  });
});

describe("generateR1Matchups", () => {
  it("produces floor(N/2) matchups per 64-roster and is deterministic", () => {
    const pods = snakeDraftPods(mkRoster(64), 8);
    const a = generateR1Matchups(pods);
    const b = generateR1Matchups(pods);
    expect(a.length).toBe(32);
    expect(a).toEqual(b);
  });

  it("every participant appears exactly once across R1 matchups", () => {
    const { r1Matchups } = seedTournament(mkRoster(64));
    const seen = new Set<string>();
    for (const m of r1Matchups) {
      expect(seen.has(m.teamA.id)).toBe(false);
      expect(seen.has(m.teamB.id)).toBe(false);
      seen.add(m.teamA.id);
      seen.add(m.teamB.id);
    }
    expect(seen.size).toBe(64);
  });

  it("pairs adjacent seeds within a pod (balanced matches)", () => {
    const pods = snakeDraftPods(mkRoster(64), 8);
    const matchups = generateR1Matchups(pods);
    for (const pod of pods) {
      const podMatchups = matchups.filter((m) => m.podId === pod.podId);
      expect(podMatchups).toHaveLength(4);
      // Member seeds in pod order are already score-desc; adjacentPairs
      // pairs index 0-1, 2-3, 4-5, 6-7.
      for (let i = 0; i < 4; i += 1) {
        expect(podMatchups[i].teamA.id).toBe(pod.members[i * 2].id);
        expect(podMatchups[i].teamB.id).toBe(pod.members[i * 2 + 1].id);
      }
    }
  });
});
