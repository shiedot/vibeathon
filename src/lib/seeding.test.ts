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

  it("pairs top vs bottom within a pod (fold pairing)", () => {
    const pods = snakeDraftPods(mkRoster(64), 8);
    const matchups = generateR1Matchups(pods);
    for (const pod of pods) {
      const podMatchups = matchups.filter((m) => m.podId === pod.podId);
      expect(podMatchups).toHaveLength(4);
      // Members are already in score-desc order from snake draft, so
      // top-vs-bottom is (0, N-1), (1, N-2), (2, N-3), (3, N-4).
      const n = pod.members.length;
      for (let i = 0; i < 4; i += 1) {
        expect(podMatchups[i].teamA.id).toBe(pod.members[i].id);
        expect(podMatchups[i].teamB.id).toBe(pod.members[n - 1 - i].id);
      }
    }
  });

  it("for an 8-member pod, pairs 1v8, 2v7, 3v6, 4v5 (highest spread first)", () => {
    const pods = snakeDraftPods(mkRoster(64), 8);
    const matchups = generateR1Matchups(pods);
    const pod1 = matchups.filter((m) => m.podId === 1);
    const members = pods[0].members;
    expect(pod1[0].teamA.id).toBe(members[0].id);
    expect(pod1[0].teamB.id).toBe(members[7].id);
    expect(pod1[1].teamA.id).toBe(members[1].id);
    expect(pod1[1].teamB.id).toBe(members[6].id);
    expect(pod1[2].teamA.id).toBe(members[2].id);
    expect(pod1[2].teamB.id).toBe(members[5].id);
    expect(pod1[3].teamA.id).toBe(members[3].id);
    expect(pod1[3].teamB.id).toBe(members[4].id);
  });
});
