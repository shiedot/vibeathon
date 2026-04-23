import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, teams } from "@/db/schema";
import { getVotingBoothState } from "@/server/voting-booth";
import { BattlesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminBattlesPage() {
  const bs = await db
    .select()
    .from(battles)
    .orderBy(asc(battles.roundNumber), asc(battles.createdAt));
  const ts = await db.select().from(teams);
  const byId = new Map(ts.map((t) => [t.id, t]));

  const booth = await getVotingBoothState({ feedLimit: 0 });
  const tallyById = new Map(booth.battles.map((b) => [b.id, b]));

  const rows = bs.map((b) => {
    const tally = tallyById.get(b.id);
    return {
      id: b.id,
      roundNumber: b.roundNumber,
      status: b.status,
      teamA: byId.get(b.teamAId)?.displayName ?? b.teamAId.slice(0, 8),
      teamAId: b.teamAId,
      teamB: byId.get(b.teamBId)?.displayName ?? b.teamBId.slice(0, 8),
      teamBId: b.teamBId,
      winnerTeamId: b.winnerTeamId,
      bettingClosesAt: b.bettingClosesAt.toISOString(),
      actualStart: b.actualStart?.toISOString() ?? null,
      tally: tally
        ? {
            aVotes: tally.teamA.votes,
            bVotes: tally.teamB.votes,
            totalVoters: tally.totalVoters,
            needed: tally.needed,
          }
        : null,
    };
  });

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Battles
        </h1>
        <p className="text-on-surface-variant text-sm">
          Start battles, close betting, nudge deadlocks to judge review. Use
          <strong className="text-emerald-300"> Pick A</strong> /
          <strong className="text-rose-300"> Pick B</strong> to declare a
          winner as organizer (overrides participant voting). Expand a row to
          see its Voting Booth tally.
        </p>
      </header>
      <BattlesClient rows={rows} />
    </main>
  );
}
