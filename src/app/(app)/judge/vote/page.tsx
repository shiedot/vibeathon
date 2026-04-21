import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, teams } from "@/db/schema";
import { getCurrentParticipant } from "@/server/current-participant";
import { JudgeVoteClient } from "./client";

export const dynamic = "force-dynamic";

export default async function JudgeVotePage() {
  const me = await getCurrentParticipant();
  const bs = await db
    .select()
    .from(battles)
    .where(sql`${battles.roundNumber} IN (5, 6)`);
  const ts = await db.select().from(teams);
  const byId = new Map(ts.map((t) => [t.id, t]));
  const rows = bs.map((b) => ({
    id: b.id,
    roundNumber: b.roundNumber,
    teamAId: b.teamAId,
    teamBId: b.teamBId,
    teamA: byId.get(b.teamAId)?.displayName ?? b.teamAId.slice(0, 8),
    teamB: byId.get(b.teamBId)?.displayName ?? b.teamBId.slice(0, 8),
    status: b.status,
    judgeVotes: b.judgeVotes,
    myVote:
      b.judgeVotes.find((v) => v.judgeId === me?.participant.id)?.teamVotedFor ??
      null,
  }));

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          SF / Final votes
        </h1>
        <p className="text-on-surface-variant text-sm">
          Your vote counts equal to one team member. Max 3 judges per matchup.
        </p>
      </header>
      {rows.length === 0 && (
        <div className="rounded-lg bg-surface-container-low p-4 text-on-surface-variant text-sm">
          No SF or Final battles yet.
        </div>
      )}
      <JudgeVoteClient rows={rows} />
    </main>
  );
}
