import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, participants, teams } from "@/db/schema";
import { PodsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminPodsPage() {
  const [tCount] = await db.select({ c: count() }).from(teams);
  const [bCount] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.roundNumber, 1));

  const [pCount] = await db
    .select({ c: count() })
    .from(participants)
    .where(
      sql`${participants.role} = 'participant' AND NOT (${participants.isPlayInParticipant} = true AND ${participants.playInResult} = 'lost')`,
    );

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Pods &amp; Round 1
        </h1>
        <p className="text-on-surface-variant text-sm">
          Preview a seeded bracket, then commit teams + R1 battles.{" "}
          {tCount.c > 0 && (
            <span className="text-tertiary">
              {tCount.c} teams and {bCount.c} Round 1 battles already exist — reset
              before re-running.
            </span>
          )}
        </p>
      </header>
      <PodsClient
        alreadyCommitted={tCount.c > 0}
        travellersRegistered={pCount.c}
      />
    </main>
  );
}
