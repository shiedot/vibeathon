import { asc, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, bets, participants, teams } from "@/db/schema";
import { OverridesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminOverridesPage() {
  const people = await db
    .select({
      id: participants.id,
      name: participants.name,
      email: participants.email,
      department: participants.department,
      role: participants.role,
      personalBankroll: participants.personalBankroll,
      currentTeamId: participants.currentTeamId,
    })
    .from(participants)
    .orderBy(asc(participants.name));

  const teamList = await db
    .select({
      id: teams.id,
      displayName: teams.displayName,
      podId: teams.podId,
      teamPot: teams.teamPot,
      isActive: teams.isActive,
      captainId: teams.captainId,
    })
    .from(teams)
    .orderBy(desc(teams.teamPot));

  const battleList = await db
    .select({
      id: battles.id,
      roundNumber: battles.roundNumber,
      status: battles.status,
      teamAId: battles.teamAId,
      teamBId: battles.teamBId,
      winnerTeamId: battles.winnerTeamId,
    })
    .from(battles)
    .orderBy(asc(battles.roundNumber), asc(battles.createdAt));
  const recentBets = await db
    .select({
      id: bets.id,
      bettorId: bets.bettorId,
      battleId: bets.battleId,
      stakeAmount: bets.stakeAmount,
      refunded: bets.refunded,
    })
    .from(bets)
    .orderBy(desc(bets.placedAt))
    .limit(50);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Overrides
        </h1>
        <p className="text-on-surface-variant text-sm">
          Hard edit state. Every action is append-only in{" "}
          <code>bankroll_ledger</code> with your user ID.
        </p>
      </header>
      <OverridesClient
        participants={people}
        teams={teamList}
        battles={battleList}
        recentBets={recentBets}
      />
    </main>
  );
}
