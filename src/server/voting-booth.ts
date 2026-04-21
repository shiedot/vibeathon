import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  battles,
  consensusVotes,
  participants,
  teamMembers,
  teams,
} from "@/db/schema";

export type VotingBoothBattle = {
  id: string;
  roundNumber: number;
  status: "pending" | "voting" | "resolved" | "deadlocked" | "disqualified";
  teamA: { id: string; name: string; votes: number };
  teamB: { id: string; name: string; votes: number };
  totalVoters: number;
  needed: number;
  remaining: number;
  bettingClosesAt: string;
  actualStart: string | null;
};

export type VotingBoothFeedItem = {
  key: string;
  battleId: string;
  roundNumber: number;
  voterId: string | null;
  voterName: string;
  side: "A" | "B";
  teamId: string;
  teamName: string;
  otherTeamName: string;
  castAt: string;
  isJudge: boolean;
};

export type VotingBoothPayload = {
  battles: VotingBoothBattle[];
  feed: VotingBoothFeedItem[];
  now: string;
};

/**
 * One-shot snapshot for the voting booth: per-battle tallies for every
 * non-resolved battle, plus a flat chronological feed of every vote across
 * those battles (newest first). Caps feed size at `feedLimit`.
 */
export async function getVotingBoothState(opts?: {
  feedLimit?: number;
}): Promise<VotingBoothPayload> {
  const feedLimit = opts?.feedLimit ?? 200;

  const liveBattles = await db
    .select()
    .from(battles)
    .where(
      sql`${battles.status} IN ('pending', 'voting', 'deadlocked')`,
    );

  if (liveBattles.length === 0) {
    return { battles: [], feed: [], now: new Date().toISOString() };
  }

  const teamIds = Array.from(
    new Set(liveBattles.flatMap((b) => [b.teamAId, b.teamBId])),
  );
  const teamRows = await db
    .select()
    .from(teams)
    .where(inArray(teams.id, teamIds));
  const teamById = new Map(teamRows.map((t) => [t.id, t]));

  // Active member counts per team (for `totalVoters`).
  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      participantId: teamMembers.participantId,
    })
    .from(teamMembers)
    .where(
      and(inArray(teamMembers.teamId, teamIds), isNull(teamMembers.leftAt)),
    );
  const memberCountByTeam = new Map<string, number>();
  for (const row of memberRows) {
    memberCountByTeam.set(
      row.teamId,
      (memberCountByTeam.get(row.teamId) ?? 0) + 1,
    );
  }

  // Participant votes (consensus_votes) for these battles.
  const battleIds = liveBattles.map((b) => b.id);
  const voteRows = await db
    .select({
      battleId: consensusVotes.battleId,
      voterId: consensusVotes.voterId,
      teamVotedForId: consensusVotes.teamVotedForId,
      castAt: consensusVotes.castAt,
    })
    .from(consensusVotes)
    .where(inArray(consensusVotes.battleId, battleIds))
    .orderBy(desc(consensusVotes.castAt));

  // Voter name lookup (only voters we need).
  const voterIds = Array.from(new Set(voteRows.map((v) => v.voterId)));
  const voterRows =
    voterIds.length === 0
      ? []
      : await db
          .select({ id: participants.id, name: participants.name })
          .from(participants)
          .where(inArray(participants.id, voterIds));
  const voterNameById = new Map(voterRows.map((v) => [v.id, v.name]));

  // Judge name lookup for embedded judgeVotes.
  const judgeIds = Array.from(
    new Set(
      liveBattles.flatMap((b) =>
        (b.judgeVotes ?? []).map((j) => j.judgeId),
      ),
    ),
  );
  const judgeRows =
    judgeIds.length === 0
      ? []
      : await db
          .select({ id: participants.id, name: participants.name })
          .from(participants)
          .where(inArray(participants.id, judgeIds));
  const judgeNameById = new Map(judgeRows.map((j) => [j.id, j.name]));

  // Per-battle tallies.
  const battleOut: VotingBoothBattle[] = [];
  const feed: VotingBoothFeedItem[] = [];
  const votesByBattle = new Map<string, typeof voteRows>();
  for (const v of voteRows) {
    const bucket = votesByBattle.get(v.battleId);
    if (bucket) bucket.push(v);
    else votesByBattle.set(v.battleId, [v]);
  }

  for (const b of liveBattles) {
    const aTeam = teamById.get(b.teamAId);
    const bTeam = teamById.get(b.teamBId);
    const aName = aTeam?.displayName ?? b.teamAId.slice(0, 8);
    const bName = bTeam?.displayName ?? b.teamBId.slice(0, 8);
    const aMembers = memberCountByTeam.get(b.teamAId) ?? 0;
    const bMembers = memberCountByTeam.get(b.teamBId) ?? 0;
    const judgeCount = (b.judgeVotes ?? []).length;
    const totalVoters = aMembers + bMembers + judgeCount;

    let aVotes = 0;
    let bVotes = 0;
    const participantVotes = votesByBattle.get(b.id) ?? [];
    for (const v of participantVotes) {
      if (v.teamVotedForId === b.teamAId) aVotes += 1;
      else if (v.teamVotedForId === b.teamBId) bVotes += 1;
    }
    for (const jv of b.judgeVotes ?? []) {
      if (jv.teamVotedFor === b.teamAId) aVotes += 1;
      else if (jv.teamVotedFor === b.teamBId) bVotes += 1;
    }

    const needed = totalVoters > 0 ? Math.floor(totalVoters / 2) + 1 : 0;
    const cast = aVotes + bVotes;

    battleOut.push({
      id: b.id,
      roundNumber: b.roundNumber,
      status: b.status,
      teamA: { id: b.teamAId, name: aName, votes: aVotes },
      teamB: { id: b.teamBId, name: bName, votes: bVotes },
      totalVoters,
      needed,
      remaining: Math.max(0, totalVoters - cast),
      bettingClosesAt: b.bettingClosesAt.toISOString(),
      actualStart: b.actualStart?.toISOString() ?? null,
    });

    for (const v of participantVotes) {
      const side = v.teamVotedForId === b.teamAId ? "A" : "B";
      feed.push({
        key: `cv:${b.id}:${v.voterId}`,
        battleId: b.id,
        roundNumber: b.roundNumber,
        voterId: v.voterId,
        voterName: voterNameById.get(v.voterId) ?? "Unknown",
        side,
        teamId: v.teamVotedForId,
        teamName: side === "A" ? aName : bName,
        otherTeamName: side === "A" ? bName : aName,
        castAt: v.castAt.toISOString(),
        isJudge: false,
      });
    }
    for (const jv of b.judgeVotes ?? []) {
      const side = jv.teamVotedFor === b.teamAId ? "A" : "B";
      const castAt =
        jv.castAt ??
        b.actualStart?.toISOString() ??
        new Date(0).toISOString();
      feed.push({
        key: `jv:${b.id}:${jv.judgeId}`,
        battleId: b.id,
        roundNumber: b.roundNumber,
        voterId: jv.judgeId,
        voterName: judgeNameById.get(jv.judgeId) ?? "Judge",
        side,
        teamId: jv.teamVotedFor,
        teamName: side === "A" ? aName : bName,
        otherTeamName: side === "A" ? bName : aName,
        castAt,
        isJudge: true,
      });
    }
  }

  feed.sort((a, b) => (a.castAt < b.castAt ? 1 : a.castAt > b.castAt ? -1 : 0));

  battleOut.sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    if (a.status !== b.status) {
      const order = { voting: 0, deadlocked: 1, pending: 2, resolved: 3, disqualified: 4 } as const;
      return order[a.status] - order[b.status];
    }
    return a.teamA.name.localeCompare(b.teamA.name);
  });

  return {
    battles: battleOut,
    feed: feed.slice(0, feedLimit),
    now: new Date().toISOString(),
  };
}

// Silence tree-shake-sensitive linters; these imports stay explicit for future
// queries that may need them.
export const _ = { eq };
