"use client";

import { useState, useTransition } from "react";
import { judgeDecideAction } from "@/app/(app)/admin/actions";

type Row = {
  id: string;
  roundNumber: number;
  teamAId: string;
  teamBId: string;
  teamA: string;
  teamB: string;
};

export function DeadlockClient({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <DeadlockRow key={r.id} row={r} />
      ))}
    </div>
  );
}

function DeadlockRow({ row }: { row: Row }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function decide(
    outcome: "pickWinner" | "flipCoin" | "dqBoth",
    winnerTeamId?: string,
  ) {
    if (!note.trim()) return setMsg("Need a reason note");
    start(async () => {
      const res = await judgeDecideAction({
        battleId: row.id,
        outcome,
        winnerTeamId,
        note,
      });
      if (!res.ok) setMsg(res.error);
      else setMsg("Decided.");
    });
  }
  return (
    <div className="rounded-xl bg-tertiary/5 p-6 border border-tertiary/30 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-tertiary font-bold">
            R{row.roundNumber} · deadlocked
          </div>
          <div className="font-headline text-xl font-bold">
            {row.teamA} <span className="text-on-surface-variant">vs</span> {row.teamB}
          </div>
        </div>
      </div>
      <textarea
        rows={2}
        placeholder="Reason for intervention"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("pickWinner", row.teamAId)}
          className="px-3 py-2 rounded-lg bg-primary text-on-primary text-[10px] uppercase font-bold tracking-widest"
        >
          Pick {row.teamA}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("pickWinner", row.teamBId)}
          className="px-3 py-2 rounded-lg bg-primary text-on-primary text-[10px] uppercase font-bold tracking-widest"
        >
          Pick {row.teamB}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("flipCoin")}
          className="px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/30 text-[10px] uppercase font-bold tracking-widest"
        >
          Flip coin
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("dqBoth")}
          className="px-3 py-2 rounded-lg bg-tertiary text-on-tertiary text-[10px] uppercase font-bold tracking-widest"
        >
          DQ both
        </button>
      </div>
      {msg && <div className="text-xs text-primary">{msg}</div>}
    </div>
  );
}
