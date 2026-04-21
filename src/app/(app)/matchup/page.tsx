"use client";

import { clsx } from "clsx";
import { useTransition } from "react";
import useSWR from "swr";
import { castVoteAction } from "@/app/actions";
import { Countdown } from "@/components/countdown";
import { useMe } from "@/hooks/live";
import type { BattleStateDetail } from "@/server/state";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function MatchupPage() {
  const me = useMe();
  const battleId = me.data?.currentBattle?.id;
  const battle = useSWR<BattleStateDetail>(
    battleId ? `/api/state/battles/${battleId}` : null,
    fetcher,
    { refreshInterval: 2000 },
  );

  if (me.isLoading) {
    return <Placeholder message="Loading your matchup..." />;
  }
  if (!me.data) return <Placeholder message="Sign in required." />;
  if (!me.data.team) {
    return <Placeholder message="You haven't been placed on a team yet. Sit tight." />;
  }
  if (!me.data.currentBattle) {
    return (
      <Placeholder message="No active matchup. You'll see one here when your battle starts." />
    );
  }

  const cb = me.data.currentBattle;
  const myTeamIsA = cb.teamAId === me.data.team.id;

  return (
    <main className="px-6 max-w-7xl mx-auto">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-label text-xs tracking-[0.2em] uppercase text-surface-tint font-bold">
              Round {cb.roundNumber} · {cb.status}
            </span>
          </div>
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter leading-none italic uppercase">
            My <span className="text-primary">Matchup</span>
          </h1>
        </div>
        <div className="flex flex-col items-start md:items-end gap-3">
          <Countdown target={cb.bettingClosesAt} label="Bet window closes" tone="tertiary" />
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
            Voting: {cb.tally.teamA + cb.tally.teamB} / {cb.tally.teamA + cb.tally.teamB + cb.tally.remaining} cast
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <TeamPanel
          isMyTeam={myTeamIsA}
          teamId={cb.teamAId}
          displayName={battle.data?.teamA.displayName ?? "Team A"}
          pot={battle.data?.teamA.pot ?? 0}
          pool={battle.data?.poolA ?? 0}
          scouts={battle.data?.scoutsA ?? 0}
          votes={cb.tally.teamA}
          canVote={cb.canVote}
          voted={cb.myVote === cb.teamAId}
          battleId={cb.id}
        />
        <div className="lg:col-span-2 flex flex-col items-center justify-center py-8">
          <div className="h-24 w-px bg-gradient-to-b from-transparent via-outline-variant to-transparent opacity-30" />
          <div className="my-8 relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <div className="relative w-20 h-20 bg-surface-container-highest border border-primary/30 rounded-full flex items-center justify-center z-10">
              <span className="font-headline text-4xl font-black italic text-primary">
                VS
              </span>
            </div>
          </div>
          <div className="h-24 w-px bg-gradient-to-b from-transparent via-outline-variant to-transparent opacity-30" />
        </div>
        <TeamPanel
          isMyTeam={!myTeamIsA}
          teamId={cb.teamBId}
          displayName={battle.data?.teamB.displayName ?? "Team B"}
          pot={battle.data?.teamB.pot ?? 0}
          pool={battle.data?.poolB ?? 0}
          scouts={battle.data?.scoutsB ?? 0}
          votes={cb.tally.teamB}
          canVote={cb.canVote}
          voted={cb.myVote === cb.teamBId}
          battleId={cb.id}
        />
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/10">
          <h3 className="font-headline text-lg font-bold uppercase mb-4">
            Consensus tally
          </h3>
          <div className="space-y-3">
            <TallyBar label="Team A" value={cb.tally.teamA} needed={cb.tally.needed} />
            <TallyBar label="Team B" value={cb.tally.teamB} needed={cb.tally.needed} />
          </div>
          <p className="text-xs text-on-surface-variant mt-4">
            {cb.tally.needed} votes needed for majority. {cb.tally.remaining} still to cast.
          </p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
          <h3 className="font-headline text-lg font-bold uppercase mb-4">
            My team
          </h3>
          <ul className="space-y-2">
            {me.data.team.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg"
              >
                <span className="material-symbols-outlined text-on-surface-variant">
                  person
                </span>
                <span className="font-medium">{m.name}</span>
                {me.data?.team?.captainId === m.id && (
                  <span className="ml-auto text-[10px] uppercase text-tertiary font-bold">
                    Captain
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}

function TeamPanel(props: {
  isMyTeam: boolean;
  teamId: string;
  displayName: string;
  pot: number;
  pool: number;
  scouts: number;
  votes: number;
  canVote: boolean;
  voted: boolean;
  battleId: string;
}) {
  const [pending, start] = useTransition();
  function vote() {
    start(async () => {
      const res = await castVoteAction({
        battleId: props.battleId,
        teamVotedForId: props.teamId,
      });
      if (!res.ok) alert(res.error);
    });
  }
  return (
    <section className="lg:col-span-5 space-y-6">
      <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
        <div className="flex items-start justify-between mb-6">
          <h2 className="font-headline text-3xl font-black italic uppercase">
            {props.displayName}
          </h2>
          {props.isMyTeam && (
            <span className="px-3 py-1 border rounded-full text-[10px] font-bold uppercase tracking-widest bg-primary/10 border-primary/20 text-primary">
              My team
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Team pot" value={`₿ ${props.pot.toLocaleString()}`} />
          <Stat label="Bet pool" value={`₿ ${props.pool.toLocaleString()}`} />
          <Stat label="Scouts" value={String(props.scouts)} />
        </div>
        <div className="mt-6 pt-6 border-t border-outline-variant/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Votes for this team</span>
            <span className="font-headline text-lg font-bold">{props.votes}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={vote}
        disabled={!props.canVote || pending}
        className={clsx(
          "w-full py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform font-headline font-black uppercase tracking-tight",
          props.voted
            ? "bg-primary/10 border border-primary/30 text-primary"
            : props.canVote
              ? "kinetic-gradient text-on-primary"
              : "bg-surface-container-highest border border-outline-variant text-on-surface-variant cursor-not-allowed",
        )}
      >
        <span className="material-symbols-outlined filled">how_to_vote</span>
        {props.voted
          ? "Voted"
          : props.canVote
            ? `Vote for ${props.displayName}`
            : "Voting closed"}
      </button>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-high rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        {label}
      </div>
      <div className="font-headline font-bold text-lg">{value}</div>
    </div>
  );
}

function TallyBar({
  label,
  value,
  needed,
}: {
  label: string;
  value: number;
  needed: number;
}) {
  const pct = needed > 0 ? Math.min(100, (value / needed) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-bold">{label}</span>
        <span className="text-on-surface-variant">
          {value}/{needed}
        </span>
      </div>
      <div className="h-2 bg-surface-container-lowest rounded-full overflow-hidden">
        <div
          className="h-full kinetic-gradient"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Placeholder({ message }: { message: string }) {
  return (
    <main className="px-6 max-w-4xl mx-auto py-16 text-center">
      <div className="inline-flex w-16 h-16 rounded-full bg-surface-container-high items-center justify-center mb-4">
        <span className="material-symbols-outlined text-on-surface-variant text-3xl">
          hourglass_empty
        </span>
      </div>
      <p className="text-on-surface-variant">{message}</p>
    </main>
  );
}
