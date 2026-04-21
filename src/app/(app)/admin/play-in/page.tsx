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
      <header className="space-y-3">
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Play-in round
        </h1>
        <p className="text-on-surface-variant text-sm max-w-3xl">
          The main bracket holds exactly 64 Travellers (8 pods of 8). When more
          than 64 have signed up, the play-in trims the field <em>before</em>{" "}
          Round 1 — a short head-to-head round that also creates a mentorship
          moment between the most senior and most junior coders in the room.
        </p>
        <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
          <div className="rounded-lg bg-surface-container-low border border-outline-variant/10 p-3 text-xs leading-relaxed">
            <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">
              Who plays in
            </div>
            <strong>Juniors</strong> (comfort ≤ 2 <em>and</em> ≤ 2 years coding)
            get paired against <strong>senior volunteers</strong> (comfort ≥ 3).
            Seniors opt in — nobody is forced to give up their main-bracket
            slot. Pairings are generated on Preview; commit writes the battles
            at scheduled start.
          </div>
          <div className="rounded-lg bg-surface-container-low border border-outline-variant/10 p-3 text-xs leading-relaxed">
            <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">
              Outcomes
            </div>
            <strong>Junior wins (upset):</strong> junior enters the main bracket
            with a full 1,000 ₿; senior is out but takes home a 500 ₿{" "}
            <em>Mentor's Honor</em> bonus. <br />
            <strong>Senior wins:</strong> senior enters the main bracket at
            1,000 ₿; junior is out of battles but gets a 200 ₿{" "}
            <em>Learner's Bankroll</em> to bet with as a scout.
          </div>
        </div>
        <p className="text-[11px] text-on-surface-variant max-w-3xl">
          If 64 or fewer Travellers are registered, the play-in is skipped
          entirely — Preview will return zero matchups. The UI below lists any
          play-in battles that already exist so you can resolve them before
          committing Round 1.
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
