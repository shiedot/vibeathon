"use client";

import { useAudit } from "@/hooks/live";

export function AuditCard() {
  const { data } = useAudit();
  const delta = data?.conservation.deltaFromExpected ?? 0;
  const ok = delta === 0;

  return (
    <div
      className={`rounded-xl p-6 border ${
        ok
          ? "bg-primary/5 border-primary/30"
          : "bg-tertiary/5 border-tertiary/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Money conservation
          </div>
          <div
            className={`font-headline text-2xl font-black mt-1 ${
              ok ? "text-primary" : "text-tertiary"
            }`}
          >
            {ok ? "CONSERVED" : `OFF BY ${delta > 0 ? "+" : ""}${delta} ₿`}
          </div>
        </div>
        {data && (
          <div className="text-right text-xs text-on-surface-variant space-y-0.5">
            <div>Bankrolls: ₿{data.totals.personalBankrolls.toLocaleString()}</div>
            <div>Team pots: ₿{data.totals.teamPots.toLocaleString()}</div>
            <div>Open bets: ₿{data.totals.openBetStakes.toLocaleString()}</div>
            <div className="pt-1 border-t border-outline-variant/20">
              Expected ₿{data.conservation.expected.toLocaleString()} · Actual ₿{data.conservation.actual.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
