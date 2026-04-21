"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type {
  VotingBoothBattle,
  VotingBoothFeedItem,
  VotingBoothPayload,
} from "@/server/voting-booth";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function VotingBoothClient({ initial }: { initial: VotingBoothPayload }) {
  const { data } = useSWR<VotingBoothPayload>(
    "/api/state/admin/voting-booth",
    fetcher,
    {
      refreshInterval: 1500,
      fallbackData: initial,
      revalidateOnFocus: false,
    },
  );

  const payload = data ?? initial;

  // Track which feed keys we've seen so new entries can animate in.
  const seenRef = useRef<Set<string>>(
    new Set(initial.feed.map((f) => f.key)),
  );
  const [recentKeys, setRecentKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const seen = seenRef.current;
    const freshlyNew: string[] = [];
    for (const item of payload.feed) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        freshlyNew.push(item.key);
      }
    }
    if (freshlyNew.length === 0) return;
    setRecentKeys((prev) => {
      const next = new Set(prev);
      for (const k of freshlyNew) next.add(k);
      return next;
    });
    const timer = setTimeout(() => {
      setRecentKeys((prev) => {
        const next = new Set(prev);
        for (const k of freshlyNew) next.delete(k);
        return next;
      });
    }, 2200);
    return () => clearTimeout(timer);
  }, [payload.feed]);

  const [battleFilter, setBattleFilter] = useState<string | null>(null);

  const filteredFeed = useMemo(() => {
    if (!battleFilter) return payload.feed;
    return payload.feed.filter((f) => f.battleId === battleFilter);
  }, [payload.feed, battleFilter]);

  if (payload.battles.length === 0) {
    return (
      <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 p-8 text-center text-on-surface-variant">
        No active battles. When R1 starts, live tallies and the vote feed will
        stream in here.
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-sm uppercase tracking-widest font-bold text-on-surface-variant">
            Battles ({payload.battles.length})
          </h2>
          {battleFilter && (
            <button
              type="button"
              onClick={() => setBattleFilter(null)}
              className="text-[10px] uppercase font-bold tracking-widest text-primary"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {payload.battles.map((b) => (
            <BattleCard
              key={b.id}
              battle={b}
              selected={battleFilter === b.id}
              onClick={() =>
                setBattleFilter((prev) => (prev === b.id ? null : b.id))
              }
            />
          ))}
        </div>
      </div>

      <aside className="sticky top-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-sm uppercase tracking-widest font-bold text-on-surface-variant">
            Live feed
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">
            {filteredFeed.length} votes
          </span>
        </div>
        <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 max-h-[70vh] overflow-y-auto">
          {filteredFeed.length === 0 ? (
            <div className="p-6 text-center text-xs text-on-surface-variant">
              No votes yet.
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/10">
              {filteredFeed.map((f) => (
                <FeedRow key={f.key} item={f} fresh={recentKeys.has(f.key)} />
              ))}
            </ul>
          )}
        </div>
      </aside>

      <style jsx global>{`
        @keyframes vb-slide-in {
          0% {
            transform: translateY(-8px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes vb-flash-green {
          0% {
            background-color: rgba(34, 197, 94, 0.25);
          }
          100% {
            background-color: transparent;
          }
        }
        @keyframes vb-flash-red {
          0% {
            background-color: rgba(239, 68, 68, 0.25);
          }
          100% {
            background-color: transparent;
          }
        }
        .vb-fresh-A {
          animation:
            vb-slide-in 240ms ease-out,
            vb-flash-green 2s ease-out;
        }
        .vb-fresh-B {
          animation:
            vb-slide-in 240ms ease-out,
            vb-flash-red 2s ease-out;
        }
      `}</style>
    </div>
  );
}

function BattleCard({
  battle,
  selected,
  onClick,
}: {
  battle: VotingBoothBattle;
  selected: boolean;
  onClick: () => void;
}) {
  const aPct =
    battle.totalVoters > 0
      ? Math.round((battle.teamA.votes / battle.totalVoters) * 100)
      : 0;
  const bPct =
    battle.totalVoters > 0
      ? Math.round((battle.teamB.votes / battle.totalVoters) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-colors ${
        selected
          ? "bg-surface-container border-primary/50"
          : "bg-surface-container-low border-outline-variant/10 hover:border-primary/20"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-headline font-bold text-xs text-on-surface-variant">
            R{battle.roundNumber}
          </span>
          <span
            className={`text-[10px] uppercase tracking-widest font-bold ${
              battle.status === "voting"
                ? "text-primary"
                : battle.status === "deadlocked"
                  ? "text-tertiary"
                  : "text-on-surface-variant"
            }`}
          >
            {battle.status}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">
          {battle.teamA.votes + battle.teamB.votes}/{battle.totalVoters} ·{" "}
          {battle.needed} to win
        </span>
      </div>

      <div className="space-y-2">
        <SideBar
          name={battle.teamA.name}
          votes={battle.teamA.votes}
          pct={aPct}
          tone="A"
        />
        <SideBar
          name={battle.teamB.name}
          votes={battle.teamB.votes}
          pct={bPct}
          tone="B"
        />
      </div>
    </button>
  );
}

function SideBar({
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

function FeedRow({
  item,
  fresh,
}: {
  item: VotingBoothFeedItem;
  fresh: boolean;
}) {
  const toneClass =
    item.side === "A"
      ? "text-emerald-400 border-l-emerald-500"
      : "text-rose-400 border-l-rose-500";
  const freshClass = fresh ? `vb-fresh-${item.side}` : "";
  const castAt = useMemo(() => new Date(item.castAt), [item.castAt]);
  return (
    <li
      className={`px-3 py-2 text-sm border-l-2 ${toneClass} ${freshClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="truncate">
          <span className="font-bold">{item.voterName}</span>
          <span className="text-on-surface-variant"> voted for </span>
          <span className="font-bold">{item.teamName}</span>
          {item.isJudge && (
            <span className="ml-2 text-[9px] uppercase tracking-widest font-bold text-tertiary">
              Judge
            </span>
          )}
        </div>
        <span className="text-[10px] text-on-surface-variant font-mono tabular-nums shrink-0">
          {formatRelative(castAt)}
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-0.5">
        R{item.roundNumber} · vs {item.otherTeamName}
      </div>
    </li>
  );
}

function formatRelative(then: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
  if (secs < 5) return "now";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}
