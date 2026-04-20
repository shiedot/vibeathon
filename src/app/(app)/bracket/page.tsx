import { clsx } from "clsx";

type MatchupRow = {
  name: string;
  score: number;
  won: boolean;
};

type Matchup = {
  teams: [MatchupRow, MatchupRow];
};

const R1: Matchup[] = [
  {
    teams: [
      { name: "CYBER_PHANTOMS", score: 142, won: true },
      { name: "VOID_RUNNERS", score: 98, won: false },
    ],
  },
  {
    teams: [
      { name: "KINETIC_FLOW", score: 156, won: true },
      { name: "PIXEL_PUNKS", score: 112, won: false },
    ],
  },
  {
    teams: [
      { name: "NEON_DRIFT", score: 84, won: false },
      { name: "DATA_DEMONS", score: 128, won: true },
    ],
  },
  {
    teams: [
      { name: "SYNTH_WAVE", score: 172, won: true },
      { name: "LOGIC_BOMB", score: 144, won: false },
    ],
  },
];

const R2: Matchup[] = [
  {
    teams: [
      { name: "CYBER_PHANTOMS", score: 188, won: true },
      { name: "KINETIC_FLOW", score: 165, won: false },
    ],
  },
  {
    teams: [
      { name: "DATA_DEMONS", score: 120, won: false },
      { name: "SYNTH_WAVE", score: 194, won: true },
    ],
  },
];

export default function BracketPage() {
  return (
    <main className="px-4 md:px-8 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-primary/10 text-primary px-3 py-1 text-xs font-bold tracking-widest uppercase rounded-full border border-primary/20">
              Active Stage
            </span>
            <span className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
              Pod Rounds
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-headline font-bold text-on-surface tracking-tighter leading-none mb-4">
            Pod <span className="text-primary italic">04</span> Bracket
          </h1>
          <p className="text-on-surface-variant text-lg max-w-xl">
            8 Travellers enter. One Captain emerges to claim the Pod and march
            to the Quarter-Final.
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex -space-x-3">
            {["R1", "R2", "R3", "SF", "F"].map((label, idx) => (
              <div
                key={label}
                className={clsx(
                  "w-12 h-12 rounded-full border-2 border-background flex items-center justify-center text-xs font-bold",
                  idx === 3
                    ? "bg-primary text-on-primary"
                    : idx === 4
                      ? "bg-tertiary text-on-tertiary"
                      : "bg-surface-container-high text-primary",
                )}
              >
                {label}
              </div>
            ))}
          </div>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            Tournament progress: 50%
          </span>
        </div>
      </div>

      {/* Bracket */}
      <div className="overflow-x-auto pb-8">
        <div className="inline-flex gap-12 min-w-[1000px] items-stretch py-4">
          {/* R1 */}
          <div className="flex flex-col justify-around gap-8 w-64">
            <div className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-4">
              Round 1 / 16 Teams
            </div>
            {R1.map((m, idx) => (
              <MatchupBlock key={`r1-${idx}`} matchup={m} />
            ))}
          </div>

          {/* Connectors */}
          <div className="flex flex-col justify-around py-16 -ml-12">
            <div className="w-6 h-[100px] border-r-2 border-t-2 border-b-2 border-primary/30 rounded-r-xl" />
            <div className="w-6 h-[100px] border-r-2 border-t-2 border-b-2 border-primary/30 rounded-r-xl mt-16" />
          </div>

          {/* R2 / QF */}
          <div className="flex flex-col justify-around gap-24 w-64">
            <div className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-4">
              Quarter Finals / R2
            </div>
            {R2.map((m, idx) => (
              <MatchupBlock key={`r2-${idx}`} matchup={m} elevated />
            ))}
          </div>

          <div className="flex flex-col justify-center py-32 -ml-12">
            <div className="w-6 h-[220px] border-r-2 border-t-2 border-b-2 border-primary/50 rounded-r-xl" />
          </div>

          {/* SF */}
          <div className="flex flex-col justify-center w-64">
            <div className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em] mb-4">
              Semi-Finals
            </div>
            <div className="bg-surface-container-high p-6 rounded-xl border-l-4 border-primary shadow-2xl flex flex-col gap-4 ring-1 ring-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-primary uppercase tracking-widest">
                  Team A
                </span>
                <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded">
                  Winner
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-black truncate font-headline tracking-tighter">
                  CYBER_PHANTOMS
                </span>
                <span className="text-primary text-2xl font-black font-headline">
                  212
                </span>
              </div>
              <div className="h-[1px] bg-outline-variant/20" />
              <div className="flex justify-between items-center opacity-40">
                <span className="text-lg font-bold truncate font-headline tracking-tighter">
                  SYNTH_WAVE
                </span>
                <span className="text-on-surface-variant text-2xl font-bold font-headline">
                  178
                </span>
              </div>
            </div>
          </div>

          {/* Final */}
          <div className="flex flex-col justify-center items-center px-12 relative">
            <div className="text-[10px] font-black text-tertiary uppercase tracking-[0.3em] mb-4 text-center">
              Grand Final
            </div>
            <div className="w-80 p-8 rounded-2xl bg-gradient-to-br from-surface-container-high to-surface-container shadow-[0_0_50px_rgba(255,206,94,0.15)] border border-tertiary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2">
                <span className="material-symbols-outlined filled text-tertiary animate-pulse">
                  stars
                </span>
              </div>
              <div className="flex flex-col items-center gap-6">
                <div className="text-center">
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                    Finalist 1
                  </div>
                  <div className="text-2xl font-black font-headline tracking-tighter text-on-surface">
                    CYBER_PHANTOMS
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-tertiary/50" />
                  <div className="font-headline font-black text-4xl text-tertiary italic">
                    VS
                  </div>
                  <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-tertiary/50" />
                </div>
                <div className="text-center opacity-60">
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                    Finalist 2
                  </div>
                  <div className="text-2xl font-black font-headline tracking-tighter text-on-surface">
                    TBD
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full bg-tertiary text-on-tertiary font-headline font-black py-4 rounded-lg uppercase tracking-widest hover:scale-[1.02] transition-transform active:scale-95 shadow-lg shadow-tertiary/20"
                >
                  View match details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pod insights */}
      <section className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-surface-container-low p-8 rounded-2xl border-l-2 border-primary/20 relative overflow-hidden">
          <h3 className="text-2xl font-headline font-bold text-on-surface mb-6 flex items-center gap-3">
            <span className="material-symbols-outlined filled text-primary">
              analytics
            </span>
            Pod 04 insights
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <MicroStat label="Avg. consensus" value="74%" tone="primary" />
            <MicroStat label="Quality index" value="9.8" tone="primary" />
            <MicroStat label="Bux wagered" value="14.2k" tone="tertiary" />
            <MicroStat label="Bet eligibility" value="62%" tone="primary" />
          </div>
          <div className="mt-10 h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-[82%] bg-gradient-to-r from-primary to-surface-tint shadow-[0_0_10px_#45edcf]" />
          </div>
        </div>
        <div className="bg-surface-container-high p-8 rounded-2xl border-l-2 border-tertiary/20 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-headline font-bold text-on-surface mb-4">
              Next match pulse
            </h3>
            <p className="text-on-surface-variant text-sm mb-6">
              Betting closes in{" "}
              <span className="text-tertiary font-mono font-bold">
                04:22:58
              </span>
            </p>
            <div className="space-y-4">
              <MatchupLine name="CYBER_PHANTOMS" odds="1.4x" tone="primary" />
              <div className="flex items-center justify-center py-1">
                <span className="text-[10px] font-black text-on-surface-variant">
                  VS
                </span>
              </div>
              <MatchupLine
                name="TBD (Pod 03 Winner)"
                odds="2.8x"
                tone="muted"
              />
            </div>
          </div>
          <button
            type="button"
            className="mt-8 py-3 w-full border border-primary/30 text-primary font-bold rounded-lg hover:bg-primary/5 transition-colors uppercase text-xs tracking-[0.2em]"
          >
            Place new wager
          </button>
        </div>
      </section>
    </main>
  );
}

function MatchupBlock({
  matchup,
  elevated = false,
}: {
  matchup: Matchup;
  elevated?: boolean;
}) {
  const [a, b] = matchup.teams;
  return (
    <div className="space-y-1 relative">
      {[a, b].map((team) => (
        <div
          key={team.name}
          className={clsx(
            "p-3 rounded-lg border-l-2 flex justify-between items-center transition-colors",
            elevated && "p-4 shadow-xl",
            team.won
              ? "bg-surface-container-low border-primary hover:bg-surface-container"
              : "bg-surface-container-lowest border-outline-variant/30 opacity-50",
            elevated && team.won && "ring-1 ring-primary/10 bg-surface-container",
          )}
        >
          <span
            className={clsx(
              "text-sm truncate",
              team.won ? "font-bold" : "font-medium",
              elevated && team.won && "font-black tracking-tight",
            )}
          >
            {team.name}
          </span>
          <span
            className={clsx(
              "font-headline",
              team.won ? "text-primary font-bold" : "text-on-surface-variant",
              elevated && team.won && "font-black",
            )}
          >
            {team.score}
          </span>
        </div>
      ))}
      <div className="absolute -right-6 top-1/2 w-6 h-[2px] bracket-line-active" />
    </div>
  );
}

function MicroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "tertiary";
}) {
  return (
    <div>
      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
        {label}
      </div>
      <div
        className={clsx(
          "text-3xl font-headline font-black",
          tone === "primary" ? "text-primary" : "text-tertiary",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function MatchupLine({
  name,
  odds,
  tone,
}: {
  name: string;
  odds: string;
  tone: "primary" | "muted";
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg border border-outline-variant/10">
      <span className="font-bold text-sm">{name}</span>
      <span
        className={clsx(
          "text-xs px-2 py-1 rounded",
          tone === "primary"
            ? "bg-primary/10 text-primary"
            : "bg-surface-container-highest text-on-surface-variant",
        )}
      >
        {odds}
      </span>
    </div>
  );
}
