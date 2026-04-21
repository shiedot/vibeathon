"use client";

import { useState, useTransition } from "react";
import { judgeVoteAction } from "../actions";

type Row = {
  id: string;
  roundNumber: number;
  teamAId: string;
  teamBId: string;
  teamA: string;
  teamB: string;
  status: string;
  judgeVotes: { judgeId: string; teamVotedFor: string }[];
  myVote: string | null;
};

export function JudgeVoteClient({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <JudgeVoteRow key={r.id} row={r} />
      ))}
    </div>
  );
}

function JudgeVoteRow({ row }: { row: Row }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const countA = row.judgeVotes.filter((v) => v.teamVotedFor === row.teamAId).length;
  const countB = row.judgeVotes.filter((v) => v.teamVotedFor === row.teamBId).length;
  function vote(teamId: string) {
    start(async () => {
      const res = await judgeVoteAction({
        battleId: row.id,
        teamVotedFor: teamId,
      });
      if (!res.ok) setMsg(res.error);
    });
  }
  return (
    <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            R{row.roundNumber} · {row.status}
          </div>
          <div className="font-headline text-xl font-bold">
            {row.teamA} <span className="text-on-surface-variant">vs</span> {row.teamB}
          </div>
        </div>
        <div className="text-xs text-on-surface-variant">
          Judge votes: {row.judgeVotes.length}/3
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={pending || row.myVote === row.teamAId}
          onClick={() => vote(row.teamAId)}
          className={
            "p-4 rounded-lg font-headline font-bold uppercase text-sm tracking-tight " +
            (row.myVote === row.teamAId
              ? "bg-primary/20 text-primary"
              : "bg-primary text-on-primary")
          }
        >
          {row.teamA} ({countA})
        </button>
        <button
          type="button"
          disabled={pending || row.myVote === row.teamBId}
          onClick={() => vote(row.teamBId)}
          className={
            "p-4 rounded-lg font-headline font-bold uppercase text-sm tracking-tight " +
            (row.myVote === row.teamBId
              ? "bg-tertiary/20 text-tertiary"
              : "bg-tertiary text-on-tertiary")
          }
        >
          {row.teamB} ({countB})
        </button>
      </div>
      {msg && <div className="text-xs text-primary mt-2">{msg}</div>}
    </div>
  );
}
