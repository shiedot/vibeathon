import { NextResponse } from "next/server";
import { and, eq, or, sql, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, bets, teams } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const open = await db
    .select()
    .from(battles)
    .where(or(eq(battles.status, "voting"), eq(battles.status, "pending")));
  const tl = await db.select().from(teams);
  const byId = new Map(tl.map((t) => [t.id, t]));
  const out: unknown[] = [];
  for (const b of open) {
    const a = byId.get(b.teamAId);
    const bt = byId.get(b.teamBId);
    if (!a || !bt) continue;
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
      teamB: { id: bt.id, displayName: bt.displayName, pot: bt.teamPot },
      poolA,
      poolB,
      scoutsA,
      scoutsB,
      bettingClosesAt: b.bettingClosesAt.toISOString(),
    });
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
