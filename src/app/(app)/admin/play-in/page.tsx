import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, participants, teams } from "@/db/schema";
import { PlayInClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminPlayInPage() {
  const existing = await db
    .select()
    .from(battles)
    .where(eq(battles.isPlayIn, true))
    .orderBy(asc(battles.createdAt));

  const teamIds = new Set<string>();
  existing.forEach((b) => {
    teamIds.add(b.teamAId);
    teamIds.add(b.teamBId);
  });
  const teamList = await db.select().from(teams);
  const teamById = new Map(teamList.map((t) => [t.id, t]));
  const participantList = await db.select().from(participants);
  const partById = new Map(participantList.map((p) => [p.id, p]));

  const rows = existing.map((b) => {
    const a = teamById.get(b.teamAId);
    const bTeam = teamById.get(b.teamBId);
    const aPart = a ? partById.get(a.captainId) : null;
    const bPart = bTeam ? partById.get(bTeam.captainId) : null;
    return {
      id: b.id,
      status: b.status,
      junior: aPart?.playInRole === "junior" ? aPart : bPart,
      senior: aPart?.playInRole === "senior_volunteer" ? aPart : bPart,
      winnerTeamId: b.winnerTeamId,
    };
  });

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Play-in round
        </h1>
        <p className="text-on-surface-variant text-sm">
          Only runs if roster &gt; 64. Pairs juniors (comfort ≤2, years ≤2) vs
          senior volunteers.
        </p>
      </header>
      <PlayInClient
        existing={rows.map((r) => ({
          id: r.id,
          status: r.status,
          juniorId: r.junior?.id ?? "",
          juniorName: r.junior?.name ?? "?",
          seniorId: r.senior?.id ?? "",
          seniorName: r.senior?.name ?? "?",
        }))}
      />
    </main>
  );
}
