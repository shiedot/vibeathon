import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { battles } from "@/db/schema";
import { attemptResolve } from "@/server/battles";

/**
 * Cast a judge vote for SF/Final (rounds 5 and 6). Judges vote alongside
 * the combined team; 1 judge vote = 1 member vote, max 3 judges per matchup.
 */
export async function castJudgeVote(opts: {
  battleId: string;
  judgeParticipantId: string;
  teamVotedFor: string;
}) {
  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, opts.battleId))
    .limit(1);
  if (!battle) throw new Error("Battle not found");
  if (battle.roundNumber < 5) {
    throw new Error("Judges can only vote in SF and Final");
  }
  if (battle.status !== "voting" && battle.status !== "deadlocked") {
    throw new Error(`Judge voting not open (status=${battle.status})`);
  }
  if (
    opts.teamVotedFor !== battle.teamAId &&
    opts.teamVotedFor !== battle.teamBId
  ) {
    throw new Error("Invalid team");
  }
  const existing = battle.judgeVotes ?? [];
  const filtered = existing.filter((v) => v.judgeId !== opts.judgeParticipantId);
  if (filtered.length >= 3) {
    throw new Error("Max 3 judges per matchup reached");
  }
  const next = [
    ...filtered,
    {
      judgeId: opts.judgeParticipantId,
      teamVotedFor: opts.teamVotedFor,
      castAt: new Date().toISOString(),
    },
  ];
  await db
    .update(battles)
    .set({ judgeVotes: next })
    .where(eq(battles.id, opts.battleId));
  // re-evaluate consensus.
  if (battle.status === "voting") {
    await attemptResolve(opts.battleId);
  }
  // Silence unused import warnings.
  void and;
  void inArray;
  void or;
  void sql;
}

export async function listSfFinalBattles() {
  return await db
    .select()
    .from(battles)
    .where(sql`${battles.roundNumber} IN (5, 6)`);
}
