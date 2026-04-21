"use client";

import { useMemo, useState, useTransition } from "react";
import {
  closeBettingAction,
  judgeDecideAction,
  startBattleAction,
  startRoundAction,
} from "../actions";

type Row = {
  id: string;
  roundNumber: number;
  status: "pending" | "voting" | "resolved" | "deadlocked" | "disqualified";
  teamA: string;
  teamAId: string;
  teamB: string;
  teamBId: string;
  winnerTeamId: string | null;
  bettingClosesAt: string;
  actualStart: string | null;
};

export function BattlesClient({ rows }: { rows: Row[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const roundsPresent = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.roundNumber))).sort();
  }, [rows]);

  function startBattle(id: string) {
    start(async () => {
      const res = await startBattleAction(id);
      if (!res.ok) setMsg(res.error);
      else setMsg(`Battle ${id.slice(0, 8)} started.`);
    });
  }
  function startRound(r: number) {
    start(async () => {
      const res = await startRoundAction(r);
      if (!res.ok) setMsg(res.error);
      else setMsg(`Round ${r}: ${res.data.started} battles started.`);
    });
  }
  function closeBet(id: string) {
    start(async () => {
      const res = await closeBettingAction(id);
      if (!res.ok) setMsg(res.error);
      else setMsg(`Bets locked for ${id.slice(0, 8)}.`);
    });
  }

  function forceDq(id: string) {
    if (!confirm("DQ both teams? Next-round opponent advances by bye.")) return;
    start(async () => {
      const res = await judgeDecideAction({
        battleId: id,
        outcome: "dqBoth",
        note: "Admin DQ from battles panel",
      });
      if (!res.ok) setMsg(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-lg bg-surface-container-low p-3 text-sm">{msg}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {roundsPresent.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => startRound(r)}
            disabled={pending}
            className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] uppercase font-bold tracking-widest"
          >
            Start all R{r} pending
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
              <th className="text-left p-3">R</th>
              <th className="text-left p-3">Match</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Bet close</th>
              <th className="text-left p-3">Winner</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-outline-variant/10">
                <td className="p-3 font-bold">{r.roundNumber}</td>
                <td className="p-3">
                  <div>{r.teamA}</div>
                  <div className="text-[10px] text-on-surface-variant">vs {r.teamB}</div>
                </td>
                <td className="p-3">
                  <span
                    className={`text-[10px] uppercase font-bold ${
                      r.status === "voting"
                        ? "text-primary"
                        : r.status === "deadlocked"
                          ? "text-tertiary"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-3 text-on-surface-variant text-xs">
                  {new Date(r.bettingClosesAt).toLocaleTimeString()}
                </td>
                <td className="p-3 text-xs">
                  {r.winnerTeamId ===
                  r.teamAId
                    ? r.teamA
                    : r.winnerTeamId === r.teamBId
                      ? r.teamB
                      : "—"}
                </td>
                <td className="p-3 text-right space-x-2">
                  {r.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => startBattle(r.id)}
                      disabled={pending}
                      className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-primary text-on-primary"
                    >
                      Start
                    </button>
                  )}
                  {r.status === "voting" && (
                    <>
                      <button
                        type="button"
                        onClick={() => closeBet(r.id)}
                        disabled={pending}
                        className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-surface-container-highest border border-outline-variant/30"
                      >
                        Lock bets
                      </button>
                      <button
                        type="button"
                        onClick={() => forceDq(r.id)}
                        disabled={pending}
                        className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-tertiary/20 text-tertiary"
                      >
                        DQ both
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
