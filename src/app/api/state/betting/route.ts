import { NextResponse } from "next/server";
import { and, eq, ne, or, sql, sum } from "drizzle-orm";
import { getCurrentParticipant } from "@/server/current-participant";
import { db } from "@/db/client";
import { battles, bets, teams } from "@/db/schema";
import { canBet } from "@/lib/bankroll";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  const p = me.participant;
  const [currentTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, p.currentTeamId ?? ""))
    .limit(1);

  const openBattles = await db
    .select()
    .from(battles)
    .where(
      or(eq(battles.status, "pending"), eq(battles.status, "voting")),
    );

  const teamRows = await db.select().from(teams);
  const teamById = new Map(teamRows.map((t) => [t.id, t]));

  const now = new Date();
  const out: unknown[] = [];
  for (const b of openBattles) {
    const a = teamById.get(b.teamAId);
    const bTeam = teamById.get(b.teamBId);
    if (!a || !bTeam) continue;
    const eligible = canBet({
      participant: {
        r1LineageRootId: p.r1LineageRootId ?? "",
        currentTeamLineageRootCaptainId: currentTeam?.lineageRootCaptainId ?? "",
        currentTeamId: p.currentTeamId ?? "",
        eliminatedByTeamId: p.eliminatedByTeamId,
      },
      battle: {
        teamAId: b.teamAId,
        teamBId: b.teamBId,
        bettingClosesAt: b.bettingClosesAt,
      },
      now,
    });
    const poolA = Number(
      (
        await db
          .select({ s: sum(bets.stakeAmount) })
          .from(bets)
          .where(and(eq(bets.battleId, b.id), eq(bets.teamBackedId, b.teamAId)))
      )[0]?.s ?? 0,
    );
    const poolB = Number(
      (
        await db
          .select({ s: sum(bets.stakeAmount) })
          .from(bets)
          .where(and(eq(bets.battleId, b.id), eq(bets.teamBackedId, b.teamBId)))
      )[0]?.s ?? 0,
    );
    const scoutsA = Number(
      (
        await db
          .select({ c: sql<number>`count(distinct ${bets.bettorId})` })
          .from(bets)
          .where(and(eq(bets.battleId, b.id), eq(bets.teamBackedId, b.teamAId)))
      )[0]?.c ?? 0,
    );
    const scoutsB = Number(
      (
        await db
          .select({ c: sql<number>`count(distinct ${bets.bettorId})` })
          .from(bets)
          .where(and(eq(bets.battleId, b.id), eq(bets.teamBackedId, b.teamBId)))
      )[0]?.c ?? 0,
    );
    out.push({
      battleId: b.id,
      roundNumber: b.roundNumber,
      status: b.status,
      teamA: { id: a.id, displayName: a.displayName, pot: a.teamPot },
      teamB: { id: bTeam.id, displayName: bTeam.displayName, pot: bTeam.teamPot },
      poolA,
      poolB,
      scoutsA,
      scoutsB,
      bettingClosesAt: b.bettingClosesAt.toISOString(),
      eligible,
    });
  }
  // Silence unused import warning.
  void ne;
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
