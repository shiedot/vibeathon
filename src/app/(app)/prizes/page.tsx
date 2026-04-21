"use client";

import { useLeaderboards } from "@/hooks/live";

const PRIZES = [
  {
    title: "Grand Champion Founder's Prize",
    amount: "৳140,000",
    criterion: "The only Traveller who never lost.",
    icon: "military_tech",
    tone: "primary",
  },
  {
    title: "Runner-Up Founder's Prize",
    amount: "৳80,000",
    criterion: "Captain of the losing Final team.",
    icon: "workspace_premium",
    tone: "tertiary",
  },
  {
    title: "Top Scout Prize",
    amount: "৳50,000",
    criterion: "Largest % bankroll growth from betting.",
    icon: "trending_up",
    tone: "primary",
  },
  {
    title: "Best Coach Prize",
    amount: "৳10,000",
    criterion: "Judges' choice, informed by your nominations.",
    icon: "volunteer_activism",
    tone: "tertiary",
  },
  {
    title: "Participation Floor",
    amount: "৳200 each",
    criterion: "Everyone walks away with something.",
    icon: "handshake",
    tone: "primary",
  },
] as const;

export default function PrizesPage() {
  const { data } = useLeaderboards();
  return (
    <main className="px-6 max-w-7xl mx-auto space-y-10">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-label text-xs uppercase tracking-[0.2em] text-primary font-bold">
            Prize ledger
          </span>
        </div>
        <h1 className="font-headline text-5xl md:text-7xl font-black uppercase tracking-tighter">
          Prizes
        </h1>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRIZES.map((p) => (
          <div
            key={p.title}
            className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`material-symbols-outlined filled ${
                  p.tone === "primary" ? "text-primary" : "text-tertiary"
                }`}
              >
                {p.icon}
              </span>
              <span
                className={`font-headline text-2xl font-black ${
                  p.tone === "primary" ? "text-primary" : "text-tertiary"
                }`}
              >
                {p.amount}
              </span>
            </div>
            <h3 className="font-headline font-bold text-sm uppercase">
              {p.title}
            </h3>
            <p className="text-xs text-on-surface-variant mt-2 leading-snug">
              {p.criterion}
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Leaderboard
          title="Top bankrolls"
          rows={
            data?.topBankrolls.map((r) => ({
              name: r.name,
              value: `₿ ${r.amount.toLocaleString()}`,
            })) ?? []
          }
        />
        <Leaderboard
          title="Top team pots"
          rows={
            data?.topTeamPots.map((r) => ({
              name: r.name ?? "(unnamed team)",
              value: `₿ ${r.amount.toLocaleString()}`,
            })) ?? []
          }
        />
        <Leaderboard
          title="Top scouts"
          rows={
            data?.topScouts.map((r) => ({
              name: r.name,
              value: `${r.growthPct >= 0 ? "+" : ""}${r.growthPct.toFixed(1)}%`,
            })) ?? []
          }
        />
      </section>
    </main>
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
    <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/20">
      <h3 className="font-headline text-sm uppercase tracking-widest font-bold mb-4 text-on-surface-variant">
        {title}
      </h3>
      {rows.length === 0 ? (
        <div className="text-xs text-on-surface-variant">No data yet.</div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between p-2 rounded bg-surface-container-lowest text-sm"
            >
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
