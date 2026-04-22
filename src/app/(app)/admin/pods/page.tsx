import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, participants, teams } from "@/db/schema";
import {
  PHANTOM_EMAIL_SUFFIX,
  PHANTOM_EMPLOYEE_ID_PREFIX,
} from "@/server/travellers";
import { PodsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminPodsPage() {
  const [tCount] = await db.select({ c: count() }).from(teams);
  const [bCount] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.roundNumber, 1));

  const isPhantom = sql`(${participants.email} LIKE ${"%" + PHANTOM_EMAIL_SUFFIX} OR ${participants.employeeId} LIKE ${PHANTOM_EMPLOYEE_ID_PREFIX + "%"})`;
  const isRoster = sql`${participants.employeeId} LIKE 'roster-%'`;
  const notLostPlayIn = sql`NOT (${participants.isPlayInParticipant} = true AND ${participants.playInResult} = 'lost')`;
  const seedable = sql`${participants.role} = 'participant' AND ${notLostPlayIn}`;

  const [seedCount] = await db
    .select({ c: count() })
    .from(participants)
    .where(seedable);

  const [rosterCount] = await db
    .select({ c: count() })
    .from(participants)
    .where(sql`${seedable} AND ${isRoster}`);

  const [phantomCount] = await db
    .select({ c: count() })
    .from(participants)
    .where(sql`${seedable} AND ${isPhantom}`);

  const [walkInCount] = await db
    .select({ c: count() })
    .from(participants)
    .where(sql`${seedable} AND NOT ${isRoster} AND NOT ${isPhantom}`);

  const [organizerCount] = await db
    .select({ c: count() })
    .from(participants)
    .where(sql`${participants.role} = 'organizer'`);

  const [judgeCount] = await db
    .select({ c: count() })
    .from(participants)
    .where(sql`${participants.role} = 'judge'`);

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
        travellersRegistered={seedCount.c}
        breakdown={{
          roster: rosterCount.c,
          walkIns: walkInCount.c,
          phantoms: phantomCount.c,
          organizers: organizerCount.c,
          judges: judgeCount.c,
        }}
      />
    </main>
  );
}
