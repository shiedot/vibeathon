"use client";

import { useState, useTransition } from "react";
import type { PlayInMatchupPreview } from "@/lib/pairing";
import {
  commitPlayInAction,
  previewPlayInAction,
  resolvePlayInAction,
} from "../actions";

type ExistingRow = {
  id: string;
  status: string;
  juniorId: string;
  juniorName: string;
  seniorId: string;
  seniorName: string;
};

export function PlayInClient({ existing }: { existing: ExistingRow[] }) {
  const [preview, setPreview] = useState<PlayInMatchupPreview[] | null>(null);
  const [totalEligible, setTotal] = useState<number | null>(null);
  const [overflow, setOverflow] = useState<number | null>(null);
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function doPreview() {
    start(async () => {
      const res = await previewPlayInAction();
      if (!res.ok) setMsg(res.error);
      else {
        setPreview(res.data.matchups);
        setTotal(res.data.total);
        setOverflow(res.data.overflow);
        if (res.data.matchups.length === 0) {
          setMsg(`Roster size ${res.data.total} — no play-in needed.`);
        } else if (res.data.matchups.length < res.data.overflow) {
          setMsg(
            `⚠ Only ${res.data.matchups.length} pairing(s) possible, but overflow is ${res.data.overflow}. Commit will fail — add more junior or senior volunteers.`,
          );
        } else {
          setMsg(
            `${res.data.matchups.length} play-in battle(s) will cap the bracket at 64.`,
          );
        }
      }
    });
  }

  function doCommit() {
    start(async () => {
      const res = await commitPlayInAction(new Date(startAt).toISOString());
      if (!res.ok) setMsg(res.error);
      else setMsg(`Created ${res.data.battlesCreated} play-in battles.`);
    });
  }

  function doResolve(battleId: string, winnerId: string) {
    start(async () => {
      const res = await resolvePlayInAction(battleId, winnerId);
      if (!res.ok) setMsg(res.error);
      else setMsg("Play-in resolved.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={doPreview}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-surface-container-high border border-outline-variant/30 font-bold uppercase text-xs tracking-widest"
          >
            Preview pairings
          </button>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
          <button
            type="button"
            onClick={doCommit}
            disabled={pending || !preview || preview.length === 0}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
          >
            Commit play-in
          </button>
        </div>
        {totalEligible != null && (
          <div className="text-xs text-on-surface-variant">
            Total eligible: <span className="font-mono">{totalEligible}</span>
            {overflow != null && overflow > 0 && (
              <>
                {" · "}overflow to cut:{" "}
                <span className="font-mono text-tertiary">{overflow}</span>
              </>
            )}
          </div>
        )}
        {msg && <div className="text-sm">{msg}</div>}
        {preview && preview.length > 0 && (
          <ul className="grid md:grid-cols-2 gap-2">
            {preview.map((m, i) => (
              <li
                key={i}
                className="p-3 bg-surface-container-lowest rounded-lg text-sm"
              >
                <span className="font-bold">{m.junior.name}</span>
                <span className="text-on-surface-variant"> (junior) vs </span>
                <span className="font-bold">{m.senior.name}</span>
                <span className="text-on-surface-variant"> (senior)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {existing.length > 0 && (
        <div className="rounded-xl bg-surface-container-low border border-outline-variant/10">
          <div className="p-3 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Existing play-in battles
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="text-left p-3">Junior</th>
                <th className="text-left p-3">Senior</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Resolve</th>
              </tr>
            </thead>
            <tbody>
              {existing.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/10">
                  <td className="p-3 font-medium">{r.juniorName}</td>
                  <td className="p-3">{r.seniorName}</td>
                  <td className="p-3 uppercase text-[10px] font-bold">
                    {r.status}
                  </td>
                  <td className="p-3 text-right space-x-1">
                    {r.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => doResolve(r.id, r.juniorId)}
                          disabled={pending}
                          className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-primary text-on-primary"
                        >
                          Junior wins
                        </button>
                        <button
                          type="button"
                          onClick={() => doResolve(r.id, r.seniorId)}
                          disabled={pending}
                          className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-tertiary text-on-tertiary"
                        >
                          Senior wins
                        </button>
                      </>
                    )}
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
