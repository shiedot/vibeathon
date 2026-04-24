"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  advanceRoundAction,
  closeBettingAction,
  editBattleWinnerAction,
  forceResolveAction,
  judgeDecideAction,
  reverseBattleAction,
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

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type RoundSummary = {
  roundNumber: number;
  total: number;
  pending: number;
  voting: number;
  deadlocked: number;
  resolved: number;
  disqualified: number;
  done: boolean;
};

type PrimaryRoundAction =
  | {
      kind: "advance";
      roundNumber: number;
      nextRound: number;
      description: string;
    }
  | {
      kind: "start";
      roundNumber: number;
      pending: number;
      description: string;
    }
  | {
      kind: "watch";
      roundNumber: number;
      description: string;
    }
  | {
      kind: "complete";
      description: string;
    }
  | {
      kind: "empty";
      description: string;
    };

type WinnerDialogState = {
  mode: "declare" | "edit";
  row: Row;
  selectedWinnerTeamId: string;
};

export function BattlesClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [winnerDialog, setWinnerDialog] = useState<WinnerDialogState | null>(null);

  const roundSummaries = useMemo(() => {
    return getRoundSummaries(rows);
  }, [rows]);

  const roundsPresent = useMemo(() => {
    return roundSummaries.map((round) => round.roundNumber);
  }, [roundSummaries]);

  const primaryAction = useMemo(() => {
    return getPrimaryRoundAction(roundSummaries);
  }, [roundSummaries]);

  function applyResult<T>(
    res: ActionResult<T>,
    getSuccessMessage: ((data: T) => string) | string,
  ) {
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg(
      typeof getSuccessMessage === "function"
        ? getSuccessMessage(res.data)
        : getSuccessMessage,
    );
    router.refresh();
  }

  function startBattle(id: string) {
    start(async () => {
      const res = await startBattleAction(id);
      applyResult(res, `Battle ${id.slice(0, 8)} started.`);
    });
  }
  function startRound(r: number) {
    start(async () => {
      const res = await startRoundAction(r);
      applyResult(res, (data) => `Round ${r}: ${data.started} battles started.`);
    });
  }
  function advanceRound(roundNumber: number) {
    if (
      !confirm(
        `End Round ${roundNumber} and create Round ${roundNumber + 1}? This will generate the next set of battles for every surviving team.`,
      )
    ) {
      return;
    }
    start(async () => {
      const res = await advanceRoundAction(roundNumber);
      applyResult(
        res,
        (data) =>
          `Round ${roundNumber} closed. Created ${data.created} battle${data.created === 1 ? "" : "s"} for Round ${data.nextRound}.`,
      );
    });
  }
  function closeBet(id: string) {
    start(async () => {
      const res = await closeBettingAction(id);
      applyResult(res, `Bets locked for ${id.slice(0, 8)}.`);
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
      applyResult(res, `Battle ${id.slice(0, 8)} disqualified.`);
    });
  }

  function openWinnerDialog(
    row: Row,
    winnerTeamId: string,
    mode: "declare" | "edit",
  ) {
    setWinnerDialog({
      mode,
      row,
      selectedWinnerTeamId: winnerTeamId,
    });
  }

  function submitWinnerDialog() {
    if (!winnerDialog) return;
    const { mode, row, selectedWinnerTeamId } = winnerDialog;
    const winnerName =
      selectedWinnerTeamId === row.teamAId ? row.teamA : row.teamB;

    start(async () => {
      const res =
        mode === "edit"
          ? await editBattleWinnerAction(row.id, selectedWinnerTeamId)
          : await forceResolveAction(
              row.id,
              selectedWinnerTeamId,
              `Organizer pick: ${winnerName}`,
            );

      if (!res.ok) {
        setMsg(res.error);
        return;
      }

      setWinnerDialog(null);
      setMsg(
        mode === "edit"
          ? `R${row.roundNumber}: winner changed to ${winnerName}.`
          : `R${row.roundNumber}: ${winnerName} declared winner.`,
      );
      router.refresh();
    });
  }

  function reverseResolved(id: string) {
    if (
      !confirm(
        "Reverse this resolution? Restores both teams, refunds bets, and tears down downstream bracket results from this branch.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await reverseBattleAction(id);
      applyResult(res, `Battle ${id.slice(0, 8)} reversed to voting.`);
    });
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-lg bg-surface-container-low p-3 text-sm">{msg}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(22rem,26rem)] xl:items-start">
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

        <section className="rounded-2xl border border-primary/30 bg-primary/10 p-4 xl:justify-self-end">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
                Round Control
              </div>
              <h2 className="mt-1 font-headline text-2xl font-black uppercase tracking-tight">
                {primaryAction.kind === "advance"
                  ? `End Round ${primaryAction.roundNumber}`
                  : primaryAction.kind === "start"
                    ? `Start Round ${primaryAction.roundNumber}`
                    : primaryAction.kind === "watch"
                      ? `Round ${primaryAction.roundNumber} Live`
                      : primaryAction.kind === "complete"
                        ? "Tournament Complete"
                        : "No Battles Yet"}
              </h2>
            </div>
            <span className="material-symbols-outlined text-primary">
              flag
            </span>
          </div>

          <p className="mt-2 text-sm text-on-surface-variant">
            {primaryAction.description}
          </p>

          {primaryAction.kind === "advance" && (
            <button
              type="button"
              onClick={() => advanceRound(primaryAction.roundNumber)}
              disabled={pending}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-on-primary shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">skip_next</span>
              End R{primaryAction.roundNumber} and Create R{primaryAction.nextRound}
            </button>
          )}

          {primaryAction.kind === "start" && (
            <button
              type="button"
              onClick={() => startRound(primaryAction.roundNumber)}
              disabled={pending}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-on-primary shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">play_arrow</span>
              Start Round {primaryAction.roundNumber}
            </button>
          )}
        </section>
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
                    <td className="p-3 align-top text-right">
                      <div className="flex flex-wrap justify-end gap-2">
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
                        {(r.status === "pending" ||
                          r.status === "voting" ||
                          r.status === "deadlocked") && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openWinnerDialog(r, r.teamAId, "declare")
                              }
                              disabled={pending}
                              title={`Declare ${r.teamA} winner (organizer override)`}
                              className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            >
                              Pick A
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openWinnerDialog(r, r.teamBId, "declare")
                              }
                              disabled={pending}
                              title={`Declare ${r.teamB} winner (organizer override)`}
                              className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            >
                              Pick B
                            </button>
                          </>
                        )}
                        {r.status === "resolved" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openWinnerDialog(
                                  r,
                                  r.winnerTeamId ?? r.teamAId,
                                  "edit",
                                )
                              }
                              disabled={pending}
                              className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-primary/15 text-primary border border-primary/30"
                            >
                              Edit winner
                            </button>
                            <button
                              type="button"
                              onClick={() => reverseResolved(r.id)}
                              disabled={pending}
                              className="text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded bg-tertiary/20 text-tertiary"
                            >
                              Reverse
                            </button>
                          </>
                        )}
                      </div>
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

      {winnerDialog && (
        <WinnerDialog
          pending={pending}
          state={winnerDialog}
          onCancel={() => setWinnerDialog(null)}
          onConfirm={submitWinnerDialog}
          onSelect={(winnerTeamId) =>
            setWinnerDialog((prev) =>
              prev ? { ...prev, selectedWinnerTeamId: winnerTeamId } : prev,
            )
          }
        />
      )}
    </div>
  );
}

function getRoundSummaries(rows: Row[]): RoundSummary[] {
  const byRound = new Map<number, RoundSummary>();

  for (const row of rows) {
    const summary = byRound.get(row.roundNumber) ?? {
      roundNumber: row.roundNumber,
      total: 0,
      pending: 0,
      voting: 0,
      deadlocked: 0,
      resolved: 0,
      disqualified: 0,
      done: false,
    };

    summary.total += 1;
    switch (row.status) {
      case "pending":
        summary.pending += 1;
        break;
      case "voting":
        summary.voting += 1;
        break;
      case "deadlocked":
        summary.deadlocked += 1;
        break;
      case "resolved":
        summary.resolved += 1;
        break;
      case "disqualified":
        summary.disqualified += 1;
        break;
    }
    byRound.set(row.roundNumber, summary);
  }

  return Array.from(byRound.values())
    .map((summary) => ({
      ...summary,
      done: summary.resolved + summary.disqualified === summary.total,
    }))
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

function getPrimaryRoundAction(
  summaries: RoundSummary[],
): PrimaryRoundAction {
  if (summaries.length === 0) {
    return {
      kind: "empty",
      description: "Create pods or play-in battles first, then manage progression here.",
    };
  }

  const roundsPresent = new Set(summaries.map((summary) => summary.roundNumber));

  for (let i = summaries.length - 1; i >= 0; i -= 1) {
    const summary = summaries[i];
    const nextRound = summary.roundNumber + 1;
    if (summary.roundNumber < 6 && summary.done && !roundsPresent.has(nextRound)) {
      return {
        kind: "advance",
        roundNumber: summary.roundNumber,
        nextRound,
        description: `Every battle in Round ${summary.roundNumber} is resolved. Close it out and generate Round ${nextRound}.`,
      };
    }
  }

  const startable = summaries.find((summary) => summary.pending > 0);
  if (startable) {
    return {
      kind: "start",
      roundNumber: startable.roundNumber,
      pending: startable.pending,
      description: `${startable.pending} pending battle${startable.pending === 1 ? "" : "s"} ready to open in Round ${startable.roundNumber}.`,
    };
  }

  const active = summaries.find((summary) => !summary.done);
  if (active) {
    const resolved = active.resolved + active.disqualified;
    return {
      kind: "watch",
      roundNumber: active.roundNumber,
      description: `${resolved}/${active.total} battles finished. Resolve the remaining battles before advancing.`,
    };
  }

  return {
    kind: "complete",
    description: "All rounds are finished. Settlement is the next admin step.",
  };
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

function WinnerDialog({
  pending,
  state,
  onCancel,
  onConfirm,
  onSelect,
}: {
  pending: boolean;
  state: WinnerDialogState;
  onCancel: () => void;
  onConfirm: () => void;
  onSelect: (winnerTeamId: string) => void;
}) {
  const { row, mode, selectedWinnerTeamId } = state;
  const selectedWinnerName =
    selectedWinnerTeamId === row.teamAId ? row.teamA : row.teamB;
  const unchanged =
    mode === "edit" && row.winnerTeamId === selectedWinnerTeamId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
              {mode === "edit" ? "Edit Winner" : "End Round"}
            </div>
            <h2 className="mt-1 font-headline text-2xl font-black uppercase tracking-tight">
              Round {row.roundNumber}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-highest"
            aria-label="Close winner confirmation"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="mt-3 text-sm text-on-surface-variant">
          Confirm you want to end Round {row.roundNumber} with{" "}
          <strong className="text-on-surface">{selectedWinnerName}</strong> as
          the winner.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TeamChoiceCard
            selected={selectedWinnerTeamId === row.teamAId}
            name={row.teamA}
            tone="A"
            onClick={() => onSelect(row.teamAId)}
          />
          <TeamChoiceCard
            selected={selectedWinnerTeamId === row.teamBId}
            name={row.teamB}
            tone="B"
            onClick={() => onSelect(row.teamBId)}
          />
        </div>

        {mode === "edit" && unchanged && (
          <p className="mt-3 text-xs text-on-surface-variant">
            Select the other team if you want to change the recorded winner and
            rebuild the downstream bracket.
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-outline-variant/30 px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || unchanged}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-on-primary disabled:opacity-50"
          >
            {mode === "edit" ? "Save winner change" : "Confirm winner"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamChoiceCard({
  selected,
  name,
  tone,
  onClick,
}: {
  selected: boolean;
  name: string;
  tone: "A" | "B";
  onClick: () => void;
}) {
  const selectedClasses =
    tone === "A"
      ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
      : "border-rose-400 bg-rose-500/15 text-rose-200";
  const idleClasses =
    "border-outline-variant/20 bg-surface-container-low text-on-surface";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors ${
        selected ? selectedClasses : idleClasses
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
        {selected ? "Selected winner" : "Choose winner"}
      </div>
      <div className="mt-1 font-bold">{name}</div>
    </button>
  );
}
