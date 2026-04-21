"use client";

import { useState, useTransition } from "react";
import type { SettlementRow } from "@/server/settlement";
import {
  commitSettlementAction,
  previewSettlementAction,
  settlementCsvAction,
} from "../actions";

export function SettlementClient() {
  const [bestCoach, setBestCoach] = useState("");
  const [rows, setRows] = useState<SettlementRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function doPreview() {
    start(async () => {
      const res = await previewSettlementAction({
        bestCoachParticipantId: bestCoach || null,
      });
      if (!res.ok) setMsg(res.error);
      else setRows(res.data);
    });
  }

  function doCommit() {
    if (!confirm("Write prize_ledger for all participants?")) return;
    start(async () => {
      const res = await commitSettlementAction({
        bestCoachParticipantId: bestCoach || null,
      });
      if (!res.ok) setMsg(res.error);
      else {
        setRows(res.data);
        setMsg("Settlement committed to prize_ledger.");
      }
    });
  }

  async function doDownload() {
    const res = await settlementCsvAction({
      bestCoachParticipantId: bestCoach || null,
    });
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    const blob = new Blob([res.data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vibeathon-settlement-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 flex flex-col md:flex-row gap-4 items-end">
        <label className="flex-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Best Coach participant ID (optional)
          </span>
          <input
            type="text"
            value={bestCoach}
            onChange={(e) => setBestCoach(e.target.value)}
            placeholder="participant UUID"
            className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={doPreview}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant/30 font-bold uppercase text-xs tracking-widest"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={doCommit}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
          >
            Commit
          </button>
          <button
            type="button"
            onClick={doDownload}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-tertiary text-on-tertiary font-bold uppercase text-xs tracking-widest"
          >
            Download CSV
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg bg-surface-container-low p-3 text-sm">{msg}</div>
      )}

      {rows && (
        <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="text-left p-3">Name</th>
                <th className="text-right p-3">Bankroll</th>
                <th className="text-right p-3">Consol</th>
                <th className="text-right p-3">Bet wins</th>
                <th className="text-right p-3">Named</th>
                <th className="text-right p-3">Floor</th>
                <th className="text-right p-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.participantId}
                  className="border-t border-outline-variant/10"
                >
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-right tabular-nums">
                    {r.bankrollTaka}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.consolationTaka}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.betWinningsTaka}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.namedPrizeTaka > 0 ? `${r.namedPrizeTaka} (${r.namedPrizeType})` : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.participationFloorTaka}
                  </td>
                  <td className="p-3 text-right tabular-nums font-headline font-bold">
                    ৳{r.totalTaka.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
