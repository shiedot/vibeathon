import { clsx } from "clsx";

type Scout = {
  rank: number;
  handle: string;
  role: string;
  bux: number;
  highlight?: boolean;
};

const SCOUTS: Scout[] = [
  { rank: 1, handle: "Vapor_Wave_99", role: "Lead Architect", bux: 12840, highlight: true },
  { rank: 2, handle: "Neon_Pulse", role: "Growth Strategist", bux: 11200 },
  { rank: 3, handle: "Zero_Day", role: "Systems Scout", bux: 9450 },
];

const NAMED_PRIZES = [
  {
    label: "Grand Champion Founder's Prize",
    taka: 140000,
    usd: 1140,
    tone: "tertiary" as const,
    crit: "Only Traveller who never lost a battle.",
  },
  {
    label: "Runner-Up Founder's Prize",
    taka: 80000,
    usd: 650,
    tone: "primary" as const,
    crit: "Captain of the losing Final team.",
  },
  {
    label: "Top Scout",
    taka: 50000,
    usd: 407,
    tone: "primary" as const,
    crit: "Largest % bankroll growth from betting.",
  },
  {
    label: "Best Coach (Judges')",
    taka: 10000,
    usd: 81,
    tone: "tertiary" as const,
    crit: "Judges' choice, informed by peer nominations.",
  },
  {
    label: "Participation Floor",
    taka: 200,
    usd: 1.63,
    tone: "primary" as const,
    crit: "Every Traveller walks away with something.",
  },
];

export default function PrizesPage() {
  return (
    <main className="px-6 max-w-7xl mx-auto space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 border-l-4 border-primary">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined filled text-[120px]">
            emoji_events
          </span>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
          <div>
            <h2 className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-bold">
              Seasonal rewards
            </h2>
            <h1 className="text-4xl md:text-6xl font-headline font-bold leading-none tracking-tight text-on-surface">
              Grand Champion
            </h1>
            <p className="text-on-surface-variant mt-4 max-w-md font-light">
              The captain who walks Round 1 through the Final without losing a
              battle takes the consolidated pot + Founder&apos;s Prize.
            </p>
          </div>
          <div className="bg-surface-container-high rounded-lg p-6 flex flex-col items-center justify-center min-w-[220px] shadow-2xl">
            <span className="text-tertiary font-headline text-5xl font-bold tracking-tighter">
              ₿ 16,777
            </span>
            <span className="text-[10px] uppercase tracking-widest text-outline mt-1 font-bold">
              + ৳140,000 Founder&apos;s Prize
            </span>
          </div>
        </div>
      </section>

      {/* Scout leaderboard */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-end">
            <h3 className="text-2xl font-headline font-bold italic tracking-tight">
              Top scouts
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-outline mb-1 font-bold">
              Live standings
            </span>
          </div>
          <div className="space-y-3">
            {SCOUTS.map((s) => (
              <ScoutRow key={s.rank} scout={s} />
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-surface-container rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined filled text-primary">
                analytics
              </span>
              <h3 className="text-lg font-headline font-bold uppercase tracking-tight">
                Your progress
              </h3>
            </div>
            <div className="mb-6">
              <div className="flex justify-between text-[10px] uppercase tracking-[0.1em] text-outline mb-2 font-bold">
                <span>Scout ranking</span>
                <span>Rank #42</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-surface-tint w-3/4 rounded-full" />
              </div>
              <div className="mt-3 flex justify-between items-baseline">
                <span className="text-xs text-on-surface-variant">
                  750 ₿ to next tier
                </span>
                <span className="text-primary font-headline font-bold">
                  2,450 / 3,200
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-high rounded-xl p-6 border-t border-tertiary/20">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined filled text-tertiary">
                groups
              </span>
              <h3 className="text-lg font-headline font-bold uppercase tracking-tight text-tertiary">
                Best Coach
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-6 font-light">
              Nominate up to 3 Travellers across the event. Private to judges.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/10">
                <span className="material-symbols-outlined text-outline">
                  person_add
                </span>
                <div className="flex-grow text-xs text-outline font-medium">
                  Select a nominee&hellip;
                </div>
              </div>
              <button
                type="button"
                className="w-full py-3 bg-tertiary text-on-tertiary font-bold uppercase text-[10px] tracking-[0.2em] rounded-lg shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                Nominate now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Named prizes */}
      <section>
        <h3 className="text-xl font-headline font-bold uppercase tracking-tight mb-6">
          Named prizes (organizer-funded)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {NAMED_PRIZES.map((p) => (
            <NamedPrize key={p.label} prize={p} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ScoutRow({ scout }: { scout: Scout }) {
  return (
    <div
      className={clsx(
        "rounded-lg p-5 flex items-center gap-6",
        scout.highlight
          ? "glass-panel border-l-2 border-tertiary shadow-[0_0_20px_rgba(255,206,94,0.1)]"
          : "bg-surface-container-low",
      )}
    >
      <div
        className={clsx(
          "font-headline font-bold text-xl w-6",
          scout.highlight ? "text-tertiary" : "text-on-surface-variant opacity-50",
        )}
      >
        {String(scout.rank).padStart(2, "0")}
      </div>
      <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/20">
        <span className="material-symbols-outlined text-on-surface-variant">
          person
        </span>
      </div>
      <div className="flex-grow">
        <div className="text-on-surface font-bold text-lg leading-tight">
          {scout.handle}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-outline">
          {scout.role}
        </div>
      </div>
      <div className="text-right">
        <div
          className={clsx(
            "font-headline font-bold text-lg",
            scout.highlight ? "text-tertiary" : "text-on-surface",
          )}
        >
          ₿ {scout.bux.toLocaleString()}
        </div>
        <div className="text-[9px] uppercase tracking-widest text-outline">
          Bux
        </div>
      </div>
    </div>
  );
}

function NamedPrize({
  prize,
}: {
  prize: {
    label: string;
    taka: number;
    usd: number;
    tone: "primary" | "tertiary";
    crit: string;
  };
}) {
  const toneBorder =
    prize.tone === "tertiary" ? "border-tertiary/30" : "border-outline-variant/10";
  const toneText = prize.tone === "tertiary" ? "text-tertiary" : "text-primary";
  const toneLabelText =
    prize.tone === "tertiary" ? "text-tertiary" : "text-outline";
  return (
    <div className={clsx("bg-surface-container-low p-6 rounded-lg border-b", toneBorder)}>
      <span
        className={clsx(
          "text-[10px] font-bold uppercase tracking-widest mb-4 block",
          toneLabelText,
        )}
      >
        Organizer-funded
      </span>
      <h4 className="text-xl font-headline font-bold text-on-surface mb-2">
        {prize.label}
      </h4>
      <p className="text-sm text-on-surface-variant font-light mb-4">
        {prize.crit}
      </p>
      <div className={clsx("font-headline font-semibold text-lg", toneText)}>
        ৳{prize.taka.toLocaleString()}{" "}
        <span className="text-xs text-on-surface-variant">
          (~${prize.usd.toLocaleString()})
        </span>
      </div>
    </div>
  );
}
