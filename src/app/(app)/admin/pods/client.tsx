"use client";

import { useState, useTransition } from "react";
import {
  commitPodsAction,
  previewPodsAction,
  resetTournamentAction,
} from "../actions";

type Preview = Extract<
  Awaited<ReturnType<typeof previewPodsAction>>,
  { ok: true }
>["data"];

export function PodsClient({ alreadyCommitted }: { alreadyCommitted: boolean }) {
  const [seed, setSeed] = useState(42);
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setHours(10, 5, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function doPreview() {
    start(async () => {
      const res = await previewPodsAction(seed);
      if (!res.ok) setMsg(res.error);
      else {
        setPreview(res.data);
        setMsg(null);
      }
    });
  }

  function doCommit() {
    if (alreadyCommitted) {
      setMsg("Reset first.");
      return;
    }
    start(async () => {
      const iso = new Date(startAt).toISOString();
      const res = await commitPodsAction(seed, iso);
      if (!res.ok) setMsg(res.error);
      else setMsg(`Committed: ${res.data.teamsCreated} teams, ${res.data.battlesCreated} battles.`);
    });
  }

  function doReset() {
    if (!confirm("Wipe teams, battles, bets, ledger? Participants stay. This cannot be undone.")) return;
    start(async () => {
      const res = await resetTournamentAction();
      if (!res.ok) setMsg(res.error);
      else {
        setPreview(null);
        setMsg("Tournament state wiped.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            Seed (for reproducible shuffle)
          </span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value, 10) || 1)}
            className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
            R1 scheduled start
          </span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="mt-1 w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-2"
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
            disabled={pending || !preview || alreadyCommitted}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase text-xs tracking-widest"
          >
            Commit
          </button>
          <button
            type="button"
            onClick={doReset}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-tertiary text-on-tertiary font-bold uppercase text-xs tracking-widest"
          >
            Reset
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg bg-surface-container-low p-3 text-sm">{msg}</div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            {preview.pods.map((pod) => (
              <div
                key={pod.podId}
                className="rounded-lg bg-surface-container-low p-3 border border-outline-variant/10"
              >
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                  Pod {pod.podId}
                </div>
                <ul className="space-y-1 text-xs">
                  {pod.members.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span>{m.name}</span>
                      <span className="text-on-surface-variant">
                        {m.department} · {m.experienceScore}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
              R1 matchups ({preview.r1Matchups.length})
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
              {preview.r1Matchups.map((m, i) => (
                <div
                  key={i}
                  className="p-3 bg-surface-container-lowest rounded-lg text-xs"
                >
                  Pod {m.podId}: {m.teamA.name}{" "}
                  <span className="text-on-surface-variant">vs</span> {m.teamB.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
