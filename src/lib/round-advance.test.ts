import { describe, expect, it } from "vitest";
import { advanceRound, type RoundWinner } from "./round-advance";

function win(teamId: string, podId: number | null, battleId = "b"): RoundWinner {
  return { teamId, podId, battleId };
}

describe("advanceRound R1 -> R2", () => {
  it("pairs R1 winners within their pod", () => {
    const winners: RoundWinner[] = [];
    for (let pod = 1; pod <= 8; pod += 1) {
      for (let i = 0; i < 4; i += 1) {
        winners.push(win(`t-${pod}-${i}`, pod));
      }
    }
    const next = advanceRound(1, winners);
    expect(next.length).toBe(16);
    expect(next.every((m) => m.roundNumber === 2)).toBe(true);
    expect(next.every((m) => m.podId != null)).toBe(true);
  });
});

describe("advanceRound R3 -> QF", () => {
  it("produces 4 cross-pod QF matchups", () => {
    const winners: RoundWinner[] = [];
    for (let pod = 1; pod <= 8; pod += 1) {
      winners.push(win(`t-${pod}`, pod));
    }
    const next = advanceRound(3, winners);
    expect(next.length).toBe(4);
    expect(next.every((m) => m.roundNumber === 4)).toBe(true);
    expect(next.every((m) => m.podId === null)).toBe(true);
  });
});

describe("advanceRound SF -> Final", () => {
  it("pairs the last two winners", () => {
    const winners: RoundWinner[] = [win("a", null), win("b", null)];
    const next = advanceRound(5, winners);
    expect(next).toEqual([
      { roundNumber: 6, podId: null, teamAId: "a", teamBId: "b" },
    ]);
  });
});
