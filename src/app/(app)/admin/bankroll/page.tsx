import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { participants, teams } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminBankrollPage() {
  const peopleRows = await db
    .select()
    .from(participants)
    .where(eq(participants.role, "participant"))
    .orderBy(desc(participants.personalBankroll));
  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.isActive, true))
    .orderBy(desc(teams.teamPot));

  return (
    <main className="space-y-8">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Bankroll audit
        </h1>
        <p className="text-on-surface-variant text-sm">
          Live view of personal bankrolls and active team pots. Use{" "}
          <code>/admin/overrides</code> to adjust.
        </p>
      </header>
      <section>
        <h2 className="text-xs uppercase tracking-widest font-bold text-on-surface-variant mb-3">
          Personal bankrolls
        </h2>
        <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Dept</th>
                <th className="text-right p-3">Bankroll</th>
                <th className="text-right p-3">Mentor</th>
                <th className="text-right p-3">Learner</th>
              </tr>
            </thead>
            <tbody>
              {peopleRows.map((p) => (
                <tr key={p.id} className="border-t border-outline-variant/10">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-on-surface-variant text-xs">
                    {p.department}
                  </td>
                  <td className="p-3 text-right tabular-nums font-headline font-bold">
                    ₿ {p.personalBankroll.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-xs text-on-surface-variant">
                    {p.mentorHonorBonus || ""}
                  </td>
                  <td className="p-3 text-right text-xs text-on-surface-variant">
                    {p.learnerBankroll || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="text-xs uppercase tracking-widest font-bold text-on-surface-variant mb-3">
          Active team pots
        </h2>
        <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="text-left p-3">Team</th>
                <th className="text-left p-3">Round</th>
                <th className="text-left p-3">Pod</th>
                <th className="text-right p-3">Pot</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((t) => (
                <tr key={t.id} className="border-t border-outline-variant/10">
                  <td className="p-3 font-medium">{t.displayName ?? t.id.slice(0, 8)}</td>
                  <td className="p-3">{t.currentRound}</td>
                  <td className="p-3 text-on-surface-variant text-xs">
                    {t.podId ?? "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums font-headline font-bold">
                    ₿ {t.teamPot.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
