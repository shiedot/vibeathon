import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, teams } from "@/db/schema";
import { DeadlockClient } from "./client";

export const dynamic = "force-dynamic";

export default async function DeadlocksPage() {
  const rows = await db
    .select()
    .from(battles)
    .where(eq(battles.status, "deadlocked"));
  const ts = await db.select().from(teams);
  const byId = new Map(ts.map((t) => [t.id, t]));
  const data = rows.map((b) => ({
    id: b.id,
    roundNumber: b.roundNumber,
    teamAId: b.teamAId,
    teamBId: b.teamBId,
    teamA: byId.get(b.teamAId)?.displayName ?? b.teamAId.slice(0, 8),
    teamB: byId.get(b.teamBId)?.displayName ?? b.teamBId.slice(0, 8),
  }));

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Deadlocks
        </h1>
        <p className="text-on-surface-variant text-sm">
          Three options per §5: make the call, flip a coin, DQ both teams.
        </p>
      </header>
      {data.length === 0 && (
        <div className="rounded-lg bg-surface-container-low p-4 text-on-surface-variant text-sm">
          No battles are currently deadlocked.
        </div>
      )}
      <DeadlockClient rows={data} />
    </main>
  );
}
