"use client";

import { clsx } from "clsx";
import { useState, useTransition } from "react";
import useSWR from "swr";
import { placeBetAction } from "@/app/actions";
import { Countdown } from "@/components/countdown";
import { useMe } from "@/hooks/live";
import { MIN_BET, maxAllowedBet } from "@/lib/bankroll";

type BettableBattle = {
  battleId: string;
  roundNumber: number;
  status: string;
  teamA: { id: string; displayName: string | null; pot: number };
  teamB: { id: string; displayName: string | null; pot: number };
  poolA: number;
  poolB: number;
  scoutsA: number;
  scoutsB: number;
  bettingClosesAt: string;
  eligible: boolean;
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function BettingPage() {
  const me = useMe();
  const list = useSWR<BettableBattle[]>(
    "/api/state/betting",
    fetcher,
    { refreshInterval: 3000 },
  );

  if (me.isLoading) return <div className="px-6 text-on-surface-variant">Loading…</div>;
  if (!me.data) return null;

  const bankroll = me.data.participant.personalBankroll;
  const max = maxAllowedBet(bankroll);

  return (
    <main className="px-6 max-w-7xl mx-auto space-y-8">
      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 border-l-4 border-primary">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="font-label uppercase tracking-[0.2em] text-primary font-bold text-xs">
              Scout floor
            </span>
            <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tighter mt-2">
              Betting <span className="text-outline">hub</span>
            </h1>
            <p className="mt-3 text-on-surface-variant max-w-md text-sm">
              Parimutuel. Min {MIN_BET} ₿. Max 50% of personal bankroll per
              matchup ({max.toLocaleString()} ₿). Betting closes halfway through
              each round.
            </p>
          </div>
          <div className="bg-surface-container-highest p-6 rounded-lg border border-outline-variant/30 min-w-[260px]">
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
              Your bankroll
            </div>
            <div className="font-headline text-4xl font-black">
              ₿ {bankroll.toLocaleString()}
            </div>
          </div>
        </div>
      </section>

      <h3 className="text-xl font-headline font-bold uppercase tracking-tight text-on-surface-variant flex items-center gap-2">
        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        Active matchups
      </h3>

      {list.isLoading && (
        <div className="text-on-surface-variant">Loading matchups…</div>
      )}

      {!list.isLoading && (list.data ?? []).length === 0 && (
        <div className="rounded-xl bg-surface-container-low p-6 border border-outline-variant/20 text-on-surface-variant text-sm">
          No battles open for betting right now.
        </div>
      )}

      <div className="space-y-6">
        {(list.data ?? []).map((b) => (
          <MatchupCard key={b.battleId} battle={b} maxBet={max} bankroll={bankroll} />
        ))}
      </div>
    </main>
  );
}

function MatchupCard({
  battle,
  maxBet,
  bankroll,
}: {
  battle: BettableBattle;
  maxBet: number;
  bankroll: number;
}) {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const [stake, setStake] = useState(Math.min(100, maxBet));

  function place(teamId: string) {
    if (!battle.eligible) return;
    start(async () => {
      const res = await placeBetAction({
        battleId: battle.battleId,
        teamBackedId: teamId,
        stakeAmount: stake,
      });
      if (!res.ok) alert(res.error);
      else setPicked(teamId);
    });
  }

  const pool = battle.poolA + battle.poolB;
  return (
    <div className="bg-surface-container rounded-xl overflow-hidden border-l-2 border-primary/20">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              R{battle.roundNumber} · {battle.status}
            </span>
            {!battle.eligible && (
              <span className="text-[10px] uppercase tracking-widest text-tertiary font-bold">
                Not eligible
              </span>
            )}
          </div>
          <Countdown target={battle.bettingClosesAt} label="Closes" tone="tertiary" />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
          <TeamBlock
            team={battle.teamA}
            pool={battle.poolA}
            scouts={battle.scoutsA}
            totalPool={pool}
          />
          <div className="text-xs font-black text-outline-variant uppercase tracking-widest">
            VS
          </div>
          <TeamBlock
            team={battle.teamB}
            pool={battle.poolB}
            scouts={battle.scoutsB}
            totalPool={pool}
          />
        </div>

        {battle.eligible && (
          <div className="mt-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <input
              type="number"
              min={MIN_BET}
              max={maxBet}
              step={10}
              value={stake}
              onChange={(e) => setStake(parseInt(e.target.value, 10) || 0)}
              className="flex-1 bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-3 font-headline font-bold"
            />
            <button
              type="button"
              disabled={
                pending || stake < MIN_BET || stake > maxBet || pending
              }
              onClick={() => place(battle.teamA.id)}
              className={clsx(
                "px-6 py-3 rounded-lg font-headline font-bold uppercase text-sm",
                picked === battle.teamA.id
                  ? "bg-primary/20 text-primary"
                  : "bg-primary text-on-primary",
              )}
            >
              Back {battle.teamA.displayName ?? "A"}
            </button>
            <button
              type="button"
              disabled={pending || stake < MIN_BET || stake > maxBet}
              onClick={() => place(battle.teamB.id)}
              className={clsx(
                "px-6 py-3 rounded-lg font-headline font-bold uppercase text-sm",
                picked === battle.teamB.id
                  ? "bg-tertiary/20 text-tertiary"
                  : "bg-tertiary text-on-tertiary",
              )}
            >
              Back {battle.teamB.displayName ?? "B"}
            </button>
          </div>
        )}
        {battle.eligible && (
          <div className="mt-2 text-[10px] uppercase tracking-widest text-on-surface-variant">
            Min {MIN_BET} ₿ · Max {maxBet.toLocaleString()} ₿ (50% of your{" "}
            {bankroll.toLocaleString()} ₿ bankroll)
          </div>
        )}
      </div>
    </div>
  );
}

function TeamBlock({
  team,
  pool,
  scouts,
  totalPool,
}: {
  team: { id: string; displayName: string | null; pot: number };
  pool: number;
  scouts: number;
  totalPool: number;
}) {
  const odds = pool > 0 && totalPool > pool ? ((totalPool / pool)).toFixed(2) : "—";
  return (
    <div className="space-y-2">
      <div className="font-headline text-2xl font-bold">
        {team.displayName ?? "Team"}
      </div>
      <div className="text-xs text-on-surface-variant">
        Pot ₿ {team.pot.toLocaleString()} · Pool ₿ {pool.toLocaleString()} ·{" "}
        {scouts} scouts
      </div>
      <div className="font-mono text-sm text-primary">{odds}x</div>
    </div>
  );
}
