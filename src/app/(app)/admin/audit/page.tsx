"use client";

import { useAudit } from "@/hooks/live";

export default function AdminAuditPage() {
  const { data, isLoading } = useAudit();

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Money conservation
        </h1>
        <p className="text-on-surface-variant text-sm">
          Σ bankrolls + team pots + open bets should equal 1000 ₿ × participants
          + organizer bonuses (mentor + learner). Polls every 3s.
        </p>
      </header>

      {isLoading && <div className="text-on-surface-variant">Loading…</div>}

      {data && (
        <>
          <div
            className={`rounded-xl p-6 border ${
              data.conservation.deltaFromExpected === 0
                ? "bg-primary/5 border-primary/30"
                : "bg-tertiary/5 border-tertiary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                  Delta from expected
                </div>
                <div
                  className={`font-headline text-5xl font-black mt-2 ${
                    data.conservation.deltaFromExpected === 0
                      ? "text-primary"
                      : "text-tertiary"
                  }`}
                >
                  {data.conservation.deltaFromExpected === 0
                    ? "0 ₿"
                    : `${data.conservation.deltaFromExpected > 0 ? "+" : ""}${data.conservation.deltaFromExpected} ₿`}
                </div>
              </div>
              <div className="text-xs text-on-surface-variant space-y-1">
                <div>Expected: ₿ {data.conservation.expected.toLocaleString()}</div>
                <div>Actual: ₿ {data.conservation.actual.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Card label="Personal bankrolls" value={data.totals.personalBankrolls} />
            <Card label="Team pots" value={data.totals.teamPots} />
            <Card label="Open bet stakes" value={data.totals.openBetStakes} />
          </div>

          <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="text-left p-3">Ledger kind</th>
                  <th className="text-right p-3">Sum</th>
                </tr>
              </thead>
              <tbody>
                {data.ledgerByKind.map((r) => (
                  <tr key={r.kind} className="border-t border-outline-variant/10">
                    <td className="p-3 font-medium">{r.kind}</td>
                    <td className="p-3 text-right tabular-nums font-headline font-bold">
                      {r.sum >= 0 ? "+" : ""}
                      {r.sum.toLocaleString()} ₿
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10">
      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        {label}
      </div>
      <div className="font-headline text-2xl font-black">
        ₿ {value.toLocaleString()}
      </div>
    </div>
  );
}
