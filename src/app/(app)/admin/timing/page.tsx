import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, teams } from "@/db/schema";
import { TimingClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminTimingPage() {
  const bs = await db
    .select()
    .from(battles)
    .orderBy(asc(battles.roundNumber), asc(battles.createdAt));
  const ts = await db.select().from(teams);
  const byId = new Map(ts.map((t) => [t.id, t]));

  const rows = bs.map((b) => ({
    id: b.id,
    roundNumber: b.roundNumber,
    status: b.status,
    teamA: byId.get(b.teamAId)?.displayName ?? b.teamAId.slice(0, 8),
    teamB: byId.get(b.teamBId)?.displayName ?? b.teamBId.slice(0, 8),
    bettingClosesAt: b.bettingClosesAt.toISOString(),
  }));

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Timing
        </h1>
        <p className="text-on-surface-variant text-sm">
          Push betting-close timestamps per battle. Default is start + duration/2.
        </p>
      </header>
      <TimingClient rows={rows} />
    </main>
  );
}
