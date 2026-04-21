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
      id: `p${i}`,
      name: `Person ${i}`,
      department: `Dept ${i % 5}`,
      preferredPitchLanguage: (["english", "bangla", "either"] as const)[i % 3],
      experienceScore: experienceScore((i % 4) + 1, i % 12),
    });
  }
  return roster;
}

describe("snakeDraftPods", () => {
  it("produces 8 pods of 8 from a 64-roster", () => {
    const pods = snakeDraftPods(mkRoster(64), 8);
    expect(pods).toHaveLength(8);
    expect(pods.every((p) => p.members.length === 8)).toBe(true);
  });

  it("places the highest-exp player in pod 1, next in pod 2", () => {
    const roster = mkRoster(16);
    const pods = snakeDraftPods(roster, 8);
    const sorted = roster.slice().sort((a, b) => b.experienceScore - a.experienceScore);
    expect(pods[0].members[0].id).toBe(sorted[0].id);
    expect(pods[1].members[0].id).toBe(sorted[1].id);
  });
});

describe("generateR1Matchups", () => {
  it("produces floor(N/2) matchups per pod and is deterministic with same seed", () => {
    const pods = snakeDraftPods(mkRoster(64), 8);
    const a = generateR1Matchups(pods, 42);
    const b = generateR1Matchups(pods, 42);
    const c = generateR1Matchups(pods, 43);
    expect(a.length).toBe(32);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("every participant appears exactly once across R1 matchups", () => {
    const { r1Matchups } = seedTournament(mkRoster(64), 7);
    const seen = new Set<string>();
    for (const m of r1Matchups) {
      expect(seen.has(m.teamA.id)).toBe(false);
      expect(seen.has(m.teamB.id)).toBe(false);
      seen.add(m.teamA.id);
      seen.add(m.teamB.id);
    }
    expect(seen.size).toBe(64);
  });
});
