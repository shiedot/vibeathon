"use client";

import useSWR from "swr";
import { useBracket, useLeaderboards } from "@/hooks/live";
import type { BracketNode } from "@/server/state";

type ActiveBattle = {
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
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function SpectatorPage() {
  const bracket = useBracket();
  const lb = useLeaderboards();
  const active = useSWR<ActiveBattle[]>(
    "/api/state/spectator/active",
    fetcher,
    { refreshInterval: 3000 },
  );

  const qfPlus = (bracket.data ?? []).filter((b) => b.roundNumber >= 4);

  return (
    <main className="min-h-screen bg-background text-on-background p-8 md:p-12 space-y-10">
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-label text-sm uppercase tracking-[0.3em] text-primary font-bold">
              Full Throttle 2026 · Vibe-a-thon
            </span>
          </div>
          <h1 className="font-headline text-7xl md:text-9xl font-black uppercase tracking-tighter">
            LIVE
          </h1>
        </div>
        <div className="text-right text-xs text-on-surface-variant">
          Auto-refreshing 3s
        </div>
      </header>

      <section>
        <h2 className="text-xs uppercase tracking-[0.3em] font-black mb-4 text-on-surface-variant">
          Active battles
        </h2>
        <div className="grid lg:grid-cols-2 gap-4">
          {(active.data ?? []).map((b) => (
            <div
              key={b.battleId}
              className="bg-surface-container-low rounded-xl p-6 border-l-4 border-primary"
            >
              <div className="flex justify-between mb-4">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                  R{b.roundNumber} · {b.status}
                </div>
                <div className="text-xs text-on-surface-variant">
                  closes {new Date(b.bettingClosesAt).toLocaleTimeString()}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <TeamBlock
                  name={b.teamA.displayName ?? "Team A"}
                  pot={b.teamA.pot}
                  pool={b.poolA}
                  scouts={b.scoutsA}
                />
                <div className="text-xs font-black text-outline-variant uppercase">
                  VS
                </div>
                <TeamBlock
                  name={b.teamB.displayName ?? "Team B"}
                  pot={b.teamB.pot}
                  pool={b.poolB}
                  scouts={b.scoutsB}
                />
              </div>
            </div>
          ))}
          {(active.data ?? []).length === 0 && (
            <div className="col-span-full rounded-xl bg-surface-container-low p-6 text-on-surface-variant">
              Nothing live right now.
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.3em] font-black mb-4 text-on-surface-variant">
          Quarterfinal → Final
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[4, 5, 6].map((r) => (
            <div key={r} className="space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                {labelForRound(r)}
              </div>
              {qfPlus
                .filter((b) => b.roundNumber === r)
                .map((b) => (
                  <BracketCardBig key={b.battleId} b={b} />
                ))}
            </div>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <Leaderboard
          title="Top bankrolls"
          rows={
            lb.data?.topBankrolls.map((r) => ({
              name: r.name,
              value: `₿${r.amount.toLocaleString()}`,
            })) ?? []
          }
        />
        <Leaderboard
          title="Biggest pots"
          rows={
            lb.data?.topTeamPots.map((r) => ({
              name: r.name ?? "(team)",
              value: `₿${r.amount.toLocaleString()}`,
            })) ?? []
          }
        />
        <Leaderboard
          title="Top scouts"
          rows={
            lb.data?.topScouts.map((r) => ({
              name: r.name,
              value: `${r.growthPct >= 0 ? "+" : ""}${r.growthPct.toFixed(1)}%`,
            })) ?? []
          }
        />
      </section>
    </main>
  );
}

function TeamBlock({
  name,
  pot,
  pool,
  scouts,
}: {
  name: string;
  pot: number;
  pool: number;
  scouts: number;
}) {
  return (
    <div>
      <div className="font-headline text-3xl font-black mb-1">{name}</div>
      <div className="text-[10px] uppercase text-on-surface-variant font-bold">
        Pot ₿{pot.toLocaleString()} · Pool ₿{pool.toLocaleString()} · {scouts} scouts
      </div>
    </div>
  );
}

function BracketCardBig({ b }: { b: BracketNode }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-3 border border-outline-variant/10 text-sm">
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        <span>R{b.roundNumber}</span>
        <span>{b.status}</span>
      </div>
      <TeamLine
        name={b.teamA?.displayName ?? "—"}
        pot={b.teamA?.pot ?? 0}
        winner={b.winnerTeamId != null && b.winnerTeamId === b.teamA?.id}
        loser={b.winnerTeamId != null && b.winnerTeamId !== b.teamA?.id}
      />
      <TeamLine
        name={b.teamB?.displayName ?? "—"}
        pot={b.teamB?.pot ?? 0}
        winner={b.winnerTeamId != null && b.winnerTeamId === b.teamB?.id}
        loser={b.winnerTeamId != null && b.winnerTeamId !== b.teamB?.id}
      />
    </div>
  );
}

function TeamLine({
  name,
  pot,
  winner,
  loser,
}: {
  name: string;
  pot: number;
  winner: boolean;
  loser: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-0.5 ${winner ? "text-primary font-bold" : ""} ${loser ? "opacity-50 line-through" : ""}`}
    >
      <span>{name}</span>
      <span className="tabular-nums">₿{pot.toLocaleString()}</span>
    </div>
  );
}

function Leaderboard({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; value: string }[];
}) {
  return (
    <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
      <h3 className="font-headline text-sm uppercase tracking-widest font-bold mb-4 text-on-surface-variant">
        {title}
      </h3>
      {rows.length === 0 ? (
        <div className="text-xs text-on-surface-variant">No data yet.</div>
      ) : (
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between text-sm">
              <span>
                <span className="text-on-surface-variant mr-2">{i + 1}.</span>
                {r.name}
              </span>
              <span className="font-headline font-bold">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function labelForRound(r: number): string {
  return (
    { 4: "Quarterfinal", 5: "Semifinal", 6: "Final" } as Record<number, string>
  )[r] ?? `Round ${r}`;
}
