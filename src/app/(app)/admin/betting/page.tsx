import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bets, participants, teams } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminBettingPage() {
  const rows = await db
    .select({
      id: bets.id,
      stake: bets.stakeAmount,
      placedAt: bets.placedAt,
      locked: bets.locked,
      refunded: bets.refunded,
      payout: bets.payoutAmount,
      bettor: participants.name,
      team: teams.displayName,
    })
    .from(bets)
    .innerJoin(participants, eq(participants.id, bets.bettorId))
    .innerJoin(teams, eq(teams.id, bets.teamBackedId))
    .orderBy(desc(bets.placedAt))
    .limit(200);

  const total = rows.reduce((s, r) => s + r.stake, 0);
  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Bet pools
        </h1>
        <p className="text-on-surface-variant text-sm">
          {rows.length} bets · total ₿ {total.toLocaleString()} staked
        </p>
      </header>
      <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
              <th className="text-left p-3">When</th>
              <th className="text-left p-3">Bettor</th>
              <th className="text-left p-3">Team</th>
              <th className="text-right p-3">Stake</th>
              <th className="text-right p-3">Payout</th>
              <th className="text-left p-3">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-outline-variant/10">
                <td className="p-3 text-xs text-on-surface-variant">
                  {new Date(r.placedAt).toLocaleTimeString()}
                </td>
                <td className="p-3">{r.bettor}</td>
                <td className="p-3">{r.team ?? "—"}</td>
                <td className="p-3 text-right tabular-nums">
                  ₿ {r.stake.toLocaleString()}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {r.payout != null ? `₿ ${r.payout.toLocaleString()}` : "—"}
                </td>
                <td className="p-3 text-[10px] uppercase font-bold">
                  {r.refunded ? "refunded" : r.locked ? "locked" : "open"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
