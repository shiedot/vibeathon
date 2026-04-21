import { describe, expect, it } from "vitest";
import { evaluateConsensus, tallyVotes } from "./voting";

describe("tally + evaluateConsensus", () => {
  it("flags majority once reached", () => {
    const tally = tallyVotes({
      teamAVoterCount: 4,
      teamBVoterCount: 4,
      teamAId: "A",
      teamBId: "B",
      votes: [
        { teamVotedForId: "A" },
        { teamVotedForId: "A" },
        { teamVotedForId: "A" },
        { teamVotedForId: "A" },
        { teamVotedForId: "A" },
      ],
    });
    const o = evaluateConsensus(tally);
    expect(o.kind).toBe("majority");
    if (o.kind === "majority") expect(o.winner).toBe("A");
  });

  it("deadlocks on a tie with everyone voted", () => {
    const tally = tallyVotes({
      teamAVoterCount: 2,
      teamBVoterCount: 2,
      teamAId: "A",
      teamBId: "B",
      votes: [
        { teamVotedForId: "A" },
        { teamVotedForId: "A" },
        { teamVotedForId: "B" },
        { teamVotedForId: "B" },
      ],
    });
    expect(evaluateConsensus(tally).kind).toBe("deadlocked");
  });

  it("in-progress when majority still reachable", () => {
    const tally = tallyVotes({
      teamAVoterCount: 4,
      teamBVoterCount: 4,
      teamAId: "A",
      teamBId: "B",
      votes: [{ teamVotedForId: "A" }, { teamVotedForId: "B" }],
    });
    expect(evaluateConsensus(tally).kind).toBe("in_progress");
  });

  it("counts judge votes toward tally", () => {
    const tally = tallyVotes({
      teamAVoterCount: 2,
      teamBVoterCount: 2,
      teamAId: "A",
      teamBId: "B",
      votes: [
        { teamVotedForId: "A" },
        { teamVotedForId: "A" },
        { teamVotedForId: "B" },
        { teamVotedForId: "B" },
      ],
      judgeVotes: [{ teamVotedFor: "A" }],
    });
    const o = evaluateConsensus(tally);
    expect(o.kind).toBe("majority");
    if (o.kind === "majority") expect(o.winner).toBe("A");
  });
});
