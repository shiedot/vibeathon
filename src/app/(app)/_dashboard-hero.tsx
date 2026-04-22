"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { useEffect, useState, useTransition } from "react";
import { castVoteAction } from "@/app/actions";
import { Countdown } from "@/components/countdown";
import { useMe, useBattle } from "@/hooks/live";

type DefaultRound = {
  label: string | null;
  endsAt: string | null;
};

/**
 * Dashboard hero. Swaps between:
 *   1. Live voting banner — when the signed-in user has a battle in `voting`
 *      status (their own match). Shows matchup details, countdown, and vote
 *      CTAs so they can resolve the battle without leaving the dashboard.
 *   2. Round / pre-event banner — otherwise. Same shape as the original
 *      "Awaiting kickoff" hero that lived in `page.tsx`.
 */
export function DashboardHero({ defaultRound }: { defaultRound: DefaultRound }) {
  const me = useMe();
  const cb = me.data?.currentBattle;
  const isVoting = cb?.status === "voting";

  if (isVoting && cb) {
    return <VotingBanner battle={cb} />;
  }

  return <RoundBanner round={defaultRound} />;
}

function RoundBanner({ round }: { round: DefaultRound }) {
  const hasRound = Boolean(round.label);
  return (
    <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 md:p-12 border-l-2 border-primary shadow-[0_0_20px_rgba(69,237,207,0.15)]">
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,var(--color-primary),transparent_70%)]" />
      </div>
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div>
          <span className="font-label text-xs uppercase tracking-[0.2em] text-primary-fixed-dim font-bold mb-2 block">
            {hasRound ? "Current round" : "Pre-event"}
          </span>
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
            {hasRound ? round.label : "Awaiting kickoff"}
          </h1>
        </div>
        <div className="bg-surface-container-highest/50 backdrop-blur-md p-6 rounded-lg border border-outline-variant/30 min-w-[260px]">
          <Countdown target={round.endsAt} label="Round ends in" />
        </div>
      </div>
    </section>
  );
}

type VotingBattle = NonNullable<
  ReturnType<typeof useMe>["data"]
>["currentBattle"];

function VotingBanner({ battle }: { battle: NonNullable<VotingBattle> }) {
  const detail = useBattle(battle.id);
  const myTeamIsA = battle.teamAId === battle.myTeamId;
  const teamAName = detail.data?.teamA.displayName ?? "Team A";
  const teamBName = detail.data?.teamB.displayName ?? "Team B";

  return (
    <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 md:p-10 border-l-2 border-tertiary shadow-[0_0_30px_rgba(255,180,100,0.15)]">
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-[0.08] pointer-events-none">
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,var(--color-tertiary),transparent_70%)]" />
      </div>

      <div className="relative z-10 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
              <span className="font-label text-xs tracking-[0.2em] uppercase text-tertiary font-bold">
                Round {battle.roundNumber} · Voting is live
              </span>
            </div>
            <h1 className="font-headline text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none italic">
              Cast your <span className="text-tertiary">vote</span>
            </h1>
          </div>
          <VotingTimer
            bettingClosesAt={battle.bettingClosesAt}
            actualStart={battle.actualStart}
          />
        </div>

        <Matchup
          myTeamIsA={myTeamIsA}
          teamAName={teamAName}
          teamBName={teamBName}
          tally={battle.tally}
        />

        <VoteActions
          battleId={battle.id}
          teamAId={battle.teamAId}
          teamBId={battle.teamBId}
          teamAName={teamAName}
          teamBName={teamBName}
          canVote={battle.canVote}
          myVote={battle.myVote}
        />
      </div>
    </section>
  );
}

function VotingTimer({
  bettingClosesAt,
  actualStart,
}: {
  bettingClosesAt: string;
  actualStart: string | null;
}) {
  const bettingMs = new Date(bettingClosesAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const bettingOpen = bettingMs > now;

  if (bettingOpen) {
    return (
      <div className="bg-surface-container-highest/50 backdrop-blur-md p-5 rounded-lg border border-tertiary/30 min-w-[240px]">
        <Countdown
          target={bettingClosesAt}
          label="Betting closes in"
          tone="tertiary"
        />
      </div>
    );
  }

  const elapsedMs = actualStart ? Math.max(0, now - new Date(actualStart).getTime()) : 0;
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1000);

  return (
    <div className="bg-surface-container-highest/50 backdrop-blur-md p-5 rounded-lg border border-outline-variant/30 min-w-[240px]">
      <span className="font-label text-[10px] uppercase tracking-widest text-gray-400 block mb-1">
        Voting open for
      </span>
      <div className="font-headline text-3xl font-black tabular-nums text-tertiary">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
    </div>
  );
}

function Matchup({
  myTeamIsA,
  teamAName,
  teamBName,
  tally,
}: {
  myTeamIsA: boolean;
  teamAName: string;
  teamBName: string;
  tally: { teamA: number; teamB: number; needed: number; remaining: number };
}) {
  const total = tally.teamA + tally.teamB + tally.remaining;
  const pctA = total > 0 ? (tally.teamA / total) * 100 : 0;
  const pctB = total > 0 ? (tally.teamB / total) * 100 : 0;

  return (
    <div className="bg-surface-container/60 rounded-xl border border-outline-variant/20 p-5 md:p-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">
        <TeamName name={teamAName} isMine={myTeamIsA} align="left" votes={tally.teamA} />
        <div className="font-headline text-xl md:text-2xl font-black italic text-on-surface-variant">
          VS
        </div>
        <TeamName name={teamBName} isMine={!myTeamIsA} align="right" votes={tally.teamB} />
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-2 bg-surface-container-lowest rounded-full overflow-hidden flex">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pctA}%` }}
          />
          <div
            className="h-full bg-tertiary transition-all"
            style={{ width: `${pctB}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-on-surface-variant">
          <span>
            {tally.teamA + tally.teamB} / {total} cast
          </span>
          <span>
            {tally.needed} needed for majority · {tally.remaining} remaining
          </span>
        </div>
      </div>
    </div>
  );
}

function TeamName({
  name,
  isMine,
  align,
  votes,
}: {
  name: string;
  isMine: boolean;
  align: "left" | "right";
  votes: number;
}) {
  return (
    <div className={clsx(align === "right" ? "text-right" : "text-left")}>
      <div
        className={clsx(
          "inline-flex items-center gap-2 mb-1",
          align === "right" && "flex-row-reverse",
        )}
      >
        {isMine && (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-primary/10 border border-primary/20 text-primary">
            My team
          </span>
        )}
      </div>
      <div className="font-headline text-2xl md:text-3xl font-black uppercase italic truncate">
        {name}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1 font-bold">
        {votes} {votes === 1 ? "vote" : "votes"}
      </div>
    </div>
  );
}

function VoteActions({
  battleId,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  canVote,
  myVote,
}: {
  battleId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  canVote: boolean;
  myVote: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(teamVotedForId: string) {
    setErr(null);
    start(async () => {
      const res = await castVoteAction({ battleId, teamVotedForId });
      if (!res.ok) setErr(res.error);
    });
  }

  if (myVote) {
    const votedName = myVote === teamAId ? teamAName : teamBName;
    return (
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 text-primary rounded-xl px-4 py-3">
          <span className="material-symbols-outlined filled">how_to_vote</span>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold">
              Vote locked
            </div>
            <div className="text-sm font-bold">You backed {votedName}</div>
          </div>
        </div>
        <Link
          href="/matchup"
          className="text-center md:text-right text-[11px] uppercase tracking-widest font-bold text-tertiary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          Open full matchup
          <span className="material-symbols-outlined text-xs">arrow_forward</span>
        </Link>
      </div>
    );
  }

  if (!canVote) {
    return (
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-3 bg-surface-container-highest border border-outline-variant/30 text-on-surface-variant rounded-xl px-4 py-3">
          <span className="material-symbols-outlined">visibility</span>
          <div className="text-sm font-medium">
            You&apos;re spectating this matchup.
          </div>
        </div>
        <Link
          href="/matchup"
          className="text-center md:text-right text-[11px] uppercase tracking-widest font-bold text-tertiary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          View live tally
          <span className="material-symbols-outlined text-xs">arrow_forward</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <VoteButton
          label={`Vote ${teamAName}`}
          onClick={() => submit(teamAId)}
          disabled={pending}
        />
        <VoteButton
          label={`Vote ${teamBName}`}
          onClick={() => submit(teamBId)}
          disabled={pending}
        />
      </div>
      {err && (
        <div className="text-xs text-error-container bg-error-container/20 border border-error/30 rounded-lg px-3 py-2">
          {err}
        </div>
      )}
      <div className="text-[11px] text-on-surface-variant text-center">
        Vote is final once you tap. Head to{" "}
        <Link href="/matchup" className="text-tertiary hover:text-primary underline">
          /matchup
        </Link>{" "}
        for full stats.
      </div>
    </div>
  );
}

function VoteButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform font-headline font-black uppercase tracking-tight kinetic-gradient text-on-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="material-symbols-outlined filled">how_to_vote</span>
      {label}
    </button>
  );
}
