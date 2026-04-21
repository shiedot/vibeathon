"use client";

import { useState, useTransition } from "react";
import { updateBettingClosesAtAction } from "../actions";

type Row = {
  id: string;
  roundNumber: number;
  status: string;
  teamA: string;
  teamB: string;
  bettingClosesAt: string;
};

export function TimingClient({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <TimingRow key={r.id} row={r} />
      ))}
    </div>
  );
}

function TimingRow({ row }: { row: Row }) {
  const [iso, setIso] = useState(row.bettingClosesAt.slice(0, 16));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function save() {
    start(async () => {
      const res = await updateBettingClosesAtAction(
        row.id,
        new Date(iso).toISOString(),
      );
      if (!res.ok) setMsg(res.error);
      else setMsg("Updated");
    });
  }
  return (
    <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/10">
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
          R{row.roundNumber} · {row.status}
        </div>
        <div className="text-sm font-medium">
          {row.teamA} <span className="text-on-surface-variant">vs</span> {row.teamB}
        </div>
      </div>
      <input
        type="datetime-local"
        value={iso}
        onChange={(e) => setIso(e.target.value)}
        className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2 text-xs"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="px-3 py-1 rounded bg-primary text-on-primary text-[10px] uppercase font-bold tracking-widest"
      >
        Save
      </button>
      {msg && <span className="text-xs text-primary">{msg}</span>}
    </div>
  );
}
