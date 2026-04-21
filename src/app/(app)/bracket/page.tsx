"use client";

import { clsx } from "clsx";
import { useBracket } from "@/hooks/live";

export default function BracketPage() {
  const { data, isLoading } = useBracket();

  const byRound = groupByRound(data ?? []);
  const rounds = [1, 2, 3, 4, 5, 6];

  return (
    <main className="px-6 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-label text-xs tracking-[0.2em] uppercase text-primary font-bold">
              Live bracket
            </span>
          </div>
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter uppercase">
            The bracket
          </h1>
        </div>
        <div className="text-xs text-on-surface-variant">
          64 → 32 → 16 → 8 → 4 → 2 → 1
        </div>
      </header>

      {isLoading && <div className="text-on-surface-variant">Loading…</div>}
      {!isLoading && (!data || data.length === 0) && (
        <div className="rounded-xl bg-surface-container-low p-8 border border-outline-variant/20 text-on-surface-variant">
          Bracket not generated yet. An organizer must seed pods + R1.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {rounds.map((r) => (
          <div key={r} className="space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              {labelForRound(r)}
            </div>
            {(byRound.get(r) ?? []).map((b) => (
              <BracketCard key={b.battleId} battle={b} />
            ))}
            {(byRound.get(r) ?? []).length === 0 && (
              <div className="rounded-lg bg-surface-container-lowest border border-outline-variant/10 p-3 text-[10px] text-on-surface-variant">
                Pending
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function BracketCard({
  battle,
}: {
  battle: {
    battleId: string;
    roundNumber: number;
    status: string;
    teamA: { id: string; displayName: string | null; pot: number } | null;
    teamB: { id: string; displayName: string | null; pot: number } | null;
    winnerTeamId: string | null;
    podId: number | null;
  };
}) {
  return (
    <div
      className={clsx(
        "rounded-lg p-3 border text-xs",
        battle.status === "resolved"
          ? "bg-surface-container-low border-outline-variant/20"
          : battle.status === "voting"
            ? "bg-primary/5 border-primary/30"
            : battle.status === "deadlocked"
              ? "bg-tertiary/5 border-tertiary/30"
              : "bg-surface-container-lowest border-outline-variant/10",
      )}
    >
      <div className="flex justify-between mb-1 text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">
        <span>{battle.podId ? `Pod ${battle.podId}` : battle.roundNumber >= 4 ? "Bracket" : "—"}</span>
        <span>{battle.status}</span>
      </div>
      <TeamLine
        team={battle.teamA}
        winner={battle.winnerTeamId === battle.teamA?.id}
        loser={
          battle.winnerTeamId != null && battle.winnerTeamId !== battle.teamA?.id
        }
      />
      <div className="h-px bg-outline-variant/20 my-1" />
      <TeamLine
        team={battle.teamB}
        winner={battle.winnerTeamId === battle.teamB?.id}
        loser={
          battle.winnerTeamId != null && battle.winnerTeamId !== battle.teamB?.id
        }
      />
    </div>
  );
}

function TeamLine({
  team,
  winner,
  loser,
}: {
  team: { displayName: string | null; pot: number } | null;
  winner: boolean;
  loser: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between py-1",
        winner && "text-primary font-bold",
        loser && "opacity-50 line-through",
      )}
    >
      <span>{team?.displayName ?? "—"}</span>
      <span className="tabular-nums">{team ? `₿${team.pot.toLocaleString()}` : ""}</span>
    </div>
  );
}

function groupByRound<T extends { roundNumber: number }>(rows: T[]) {
  const m = new Map<number, T[]>();
  for (const r of rows) {
    const bucket = m.get(r.roundNumber) ?? [];
    bucket.push(r);
    m.set(r.roundNumber, bucket);
  }
  return m;
}

function labelForRound(r: number): string {
  return (
    { 1: "Round 1", 2: "Round 2", 3: "Round 3", 4: "Quarterfinal", 5: "Semifinal", 6: "Final" } as Record<number, string>
  )[r] ?? `Round ${r}`;
}
