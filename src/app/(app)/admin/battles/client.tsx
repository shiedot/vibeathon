"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
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
  tally: {
    aVotes: number;
    bVotes: number;
    totalVoters: number;
    needed: number;
  } | null;
};

export function BattlesClient({ rows }: { rows: Row[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
              <th className="text-left p-3 w-6" />
              <th className="text-left p-3">R</th>
              <th className="text-left p-3">Match</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Tally</th>
              <th className="text-left p-3">Bet close</th>
              <th className="text-left p-3">Winner</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expanded = expandedId === r.id;
              const cast = r.tally ? r.tally.aVotes + r.tally.bVotes : 0;
              const total = r.tally?.totalVoters ?? 0;
              const aPct =
                total > 0 ? Math.round((r.tally!.aVotes / total) * 100) : 0;
              const bPct =
                total > 0 ? Math.round((r.tally!.bVotes / total) * 100) : 0;
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-outline-variant/10">
                    <td className="p-3 align-top">
                      <button
                        type="button"
                        aria-label={expanded ? "Collapse" : "Expand"}
                        onClick={() =>
                          setExpandedId((prev) => (prev === r.id ? null : r.id))
                        }
                        className="w-6 h-6 rounded hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant"
                      >
                        <span className="material-symbols-outlined text-base">
                          {expanded ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                    </td>
                    <td className="p-3 font-bold align-top">{r.roundNumber}</td>
                    <td className="p-3 align-top">
                      <div>{r.teamA}</div>
                      <div className="text-[10px] text-on-surface-variant">
                        vs {r.teamB}
                      </div>
                    </td>
                    <td className="p-3 align-top">
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
                    <td className="p-3 align-top text-xs font-mono tabular-nums">
                      {r.tally ? (
                        <span>
                          <span className="text-emerald-400">
                            {r.tally.aVotes}
                          </span>
                          <span className="text-on-surface-variant">
                            {" "}
                            –{" "}
                          </span>
                          <span className="text-rose-400">{r.tally.bVotes}</span>
                          <span className="text-on-surface-variant">
                            {" / "}
                            {total}
                          </span>
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="p-3 align-top text-on-surface-variant text-xs">
                      {new Date(r.bettingClosesAt).toLocaleTimeString()}
                    </td>
                    <td className="p-3 align-top text-xs">
                      {r.winnerTeamId === r.teamAId
                        ? r.teamA
                        : r.winnerTeamId === r.teamBId
                          ? r.teamB
                          : "—"}
                    </td>
                    <td className="p-3 align-top text-right space-x-2">
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
                  {expanded && (
                    <tr className="border-t border-outline-variant/10 bg-surface-container-lowest">
                      <td colSpan={8} className="p-4">
                        <div className="grid md:grid-cols-[1fr_auto] gap-4 items-center">
                          <div className="space-y-2">
                            <TallyBar
                              name={r.teamA}
                              votes={r.tally?.aVotes ?? 0}
                              pct={aPct}
                              tone="A"
                            />
                            <TallyBar
                              name={r.teamB}
                              votes={r.tally?.bVotes ?? 0}
                              pct={bPct}
                              tone="B"
                            />
                            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                              {cast} cast / {total} eligible · {r.tally?.needed ?? 0} needed for majority
                            </div>
                          </div>
                          <Link
                            href="/admin/voting-booth"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-on-primary text-[10px] uppercase font-bold tracking-widest self-start"
                          >
                            <span className="material-symbols-outlined text-base">
                              how_to_vote
                            </span>
                            Open Voting Booth
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TallyBar({
  name,
  votes,
  pct,
  tone,
}: {
  name: string;
  votes: number;
  pct: number;
  tone: "A" | "B";
}) {
  const color = tone === "A" ? "bg-emerald-500" : "bg-rose-500";
  const textColor = tone === "A" ? "text-emerald-400" : "text-rose-400";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="font-bold truncate pr-2">{name}</span>
        <span className={`font-mono tabular-nums ${textColor}`}>
          {votes} · {pct}%
        </span>
      </div>
      <div className="h-2 bg-surface-container-lowest rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
