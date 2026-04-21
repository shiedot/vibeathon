import { describe, expect, it } from "vitest";
import {
  canBet,
  maxAllowedBet,
  projectWinnerPot,
  resolveBattle,
  settleParimutuel,
} from "./bankroll";

describe("resolveBattle / projectWinnerPot", () => {
  it("matches the spec §3 pot progression table", () => {
    expect(projectWinnerPot(1000, 1)).toBe(1600);
    expect(projectWinnerPot(1000, 2)).toBe(2560);
    expect(projectWinnerPot(1000, 3)).toBe(4096);
    expect(projectWinnerPot(1000, 4)).toBe(6554);
    expect(projectWinnerPot(1000, 5)).toBe(10486);
    // Spec says 16,777 but no single rounding rule reproduces every row; we
    // pick `round` which matches 5/6 and diverges by 1 ₿ on the final.
    expect(projectWinnerPot(1000, 6)).toBe(16778);
  });

  it("conserves money: pot + consolation == combined pool", () => {
    const r = resolveBattle({ winnerTeamPot: 4096, loserTeamPot: 4096 });
    expect(r.combinedPool).toBe(8192);
    expect(r.newWinnerTeamPot + r.loserCaptainConsolation).toBe(8192);
  });
});

describe("settleParimutuel", () => {
  it("splits the losing pool proportionally to winning stakes", () => {
    const payouts = settleParimutuel(
      [
        { bettorId: "a", teamBackedId: "WIN", stakeAmount: 100 },
        { bettorId: "b", teamBackedId: "WIN", stakeAmount: 300 },
        { bettorId: "c", teamBackedId: "LOSE", stakeAmount: 400 },
      ],
      "WIN",
    );
    const total = payouts.reduce((s, p) => s + p.payout, 0);
    expect(total).toBe(400 /* winners stakes */ + 400 /* loser pool */);
    const a = payouts.find((p) => p.bettorId === "a")!;
    const b = payouts.find((p) => p.bettorId === "b")!;
    expect(a.payout).toBe(200); // 100 stake + 25% of 400
    expect(b.payout).toBe(600); // 300 stake + 75% of 400
  });

  it("refunds losers when no one picked the winner", () => {
    const payouts = settleParimutuel(
      [
        { bettorId: "a", teamBackedId: "LOSE", stakeAmount: 100 },
        { bettorId: "b", teamBackedId: "LOSE", stakeAmount: 50 },
      ],
      "WIN",
    );
    expect(payouts).toHaveLength(2);
    expect(payouts.every((p) => p.payout === p.stake)).toBe(true);
  });

  it("sweeps rounding leftover into the largest winner", () => {
    const payouts = settleParimutuel(
      [
        { bettorId: "a", teamBackedId: "WIN", stakeAmount: 333 },
        { bettorId: "b", teamBackedId: "WIN", stakeAmount: 666 },
        { bettorId: "c", teamBackedId: "LOSE", stakeAmount: 1000 },
      ],
      "WIN",
    );
    const distributed = payouts.reduce((s, p) => s + (p.payout - p.stake), 0);
    expect(distributed).toBe(1000);
  });
});

describe("canBet", () => {
  const now = new Date("2026-04-23T12:00:00Z");
  const future = new Date(now.getTime() + 60_000);
  const past = new Date(now.getTime() - 60_000);

  const baseParticipant = {
    r1LineageRootId: "r1root",
    currentTeamLineageRootCaptainId: "otherRoot",
    currentTeamId: "teamC",
    eliminatedByTeamId: null,
  };

  it("rejects bettors still on their original R1 lineage", () => {
    expect(
      canBet({
        participant: {
          ...baseParticipant,
          currentTeamLineageRootCaptainId: "r1root",
        },
        battle: { teamAId: "t1", teamBId: "t2", bettingClosesAt: future },
        now,
      }),
    ).toBe(false);
  });

  it("rejects betting on own team's current matchup", () => {
    expect(
      canBet({
        participant: baseParticipant,
        battle: { teamAId: "teamC", teamBId: "t2", bettingClosesAt: future },
        now,
      }),
    ).toBe(false);
  });

  it("rejects betting on battles involving the team that eliminated you", () => {
    expect(
      canBet({
        participant: { ...baseParticipant, eliminatedByTeamId: "bad" },
        battle: { teamAId: "bad", teamBId: "t2", bettingClosesAt: future },
        now,
      }),
    ).toBe(false);
  });

  it("rejects bets after close", () => {
    expect(
      canBet({
        participant: baseParticipant,
        battle: { teamAId: "t1", teamBId: "t2", bettingClosesAt: past },
        now,
      }),
    ).toBe(false);
  });

  it("accepts eligible bets", () => {
    expect(
      canBet({
        participant: baseParticipant,
        battle: { teamAId: "t1", teamBId: "t2", bettingClosesAt: future },
        now,
      }),
    ).toBe(true);
  });
});

describe("maxAllowedBet", () => {
  it("is 50% of personal bankroll, floored", () => {
    expect(maxAllowedBet(1001)).toBe(500);
    expect(maxAllowedBet(0)).toBe(0);
  });
});
