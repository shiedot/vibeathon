import { clsx } from "clsx";

type BettingMatchup = {
  left: { name: string; icon: string; odds: string };
  right: { name: string; icon: string; odds: string };
  totalPool: number;
  scouts: number;
  highlighted?: boolean;
};

const MATCHUPS: BettingMatchup[] = [
  {
    left: { name: "CYBER_DRAGONS", icon: "rocket_launch", odds: "1.85x" },
    right: { name: "VOID_WALKERS", icon: "cyclone", odds: "2.10x" },
    totalPool: 14200,
    scouts: 142,
    highlighted: true,
  },
  {
    left: { name: "NEON_KNIGHTS", icon: "shield", odds: "1.40x" },
    right: { name: "DATA_SENTINELS", icon: "security", odds: "3.25x" },
    totalPool: 8900,
    scouts: 89,
  },
];

type ActiveBet = {
  team: string;
  vs: string;
  stake: number;
  odds: string;
  status: "live" | "pending";
};

const ACTIVE_BETS: ActiveBet[] = [
  {
    team: "CYBER_DRAGONS",
    vs: "VOID_WALKERS",
    stake: 500,
    odds: "1.85x",
    status: "live",
  },
  {
    team: "DATA_SENTINELS",
    vs: "NEON_KNIGHTS",
    stake: 250,
    odds: "3.25x",
    status: "pending",
  },
];

export default function BettingPage() {
  return (
    <main className="px-6 max-w-7xl mx-auto space-y-8">
      {/* Hero / countdown */}
      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 border-l-4 border-primary">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="font-label uppercase tracking-[0.2em] text-primary font-bold text-xs">
              Scout Floor
            </span>
            <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tighter mt-2">
              Betting <span className="text-outline">Hub</span>
            </h1>
            <p className="mt-3 text-on-surface-variant max-w-md text-sm">
              Parimutuel. Min 10 ₿. Max 50% of personal bankroll per matchup.
              Betting closes halfway through the round.
            </p>
          </div>
          <div className="bg-surface-container-highest p-6 rounded-lg border border-outline-variant/30 min-w-[280px]">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-tertiary">
                timer
              </span>
              <span className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                Betting closes in
              </span>
            </div>
            <div className="flex gap-4 items-baseline">
              <div className="text-4xl font-headline font-black text-tertiary tabular-nums">
                01:42:15
              </div>
              <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-tertiary to-primary h-full w-1/2" />
              </div>
            </div>
          </div>
        </div>
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(#45edcf 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-6">
          <h3 className="text-xl font-headline font-bold uppercase tracking-tight text-on-surface-variant flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Active matchups
          </h3>
          {MATCHUPS.map((m, idx) => (
            <MatchupCard key={idx} matchup={m} />
          ))}
        </div>

        <aside className="space-y-8">
          <WagerControl bankroll={2450} />
          <ExposurePanel bets={ACTIVE_BETS} />
        </aside>
      </div>
    </main>
  );
}

function MatchupCard({ matchup }: { matchup: BettingMatchup }) {
  return (
    <div
      className={clsx(
        "relative bg-surface-container rounded-xl overflow-hidden transition-colors hover:bg-surface-container-high border-l-2",
        matchup.highlighted ? "border-primary/20" : "border-outline-variant/20",
      )}
    >
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <TeamBlock
            side="left"
            name={matchup.left.name}
            icon={matchup.left.icon}
            odds={matchup.left.odds}
          />
          <div className="flex flex-col items-center">
            <div className="text-xs font-black text-outline-variant uppercase tracking-widest mb-1">
              VS
            </div>
            <div className="h-12 w-[1px] bg-gradient-to-b from-transparent via-outline-variant to-transparent" />
          </div>
          <TeamBlock
            side="right"
            name={matchup.right.name}
            icon={matchup.right.icon}
            odds={matchup.right.odds}
          />
        </div>

        <div className="mt-8 flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
          <div className="flex gap-12">
            <div>
              <div className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest mb-1">
                Total pool
              </div>
              <div className="text-lg font-headline font-bold">
                ₿ {matchup.totalPool.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest mb-1">
                Scouts joined
              </div>
              <div className="text-lg font-headline font-bold">
                {matchup.scouts}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={clsx(
              "px-8 py-2.5 rounded-lg font-headline font-bold uppercase text-sm transition-all active:scale-95",
              matchup.highlighted
                ? "bg-primary text-on-primary shadow-lg shadow-primary/20 hover:brightness-110"
                : "bg-surface-container-highest text-primary border border-primary/30 hover:bg-primary/10",
            )}
          >
            Place bet
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamBlock({
  side,
  name,
  icon,
  odds,
}: {
  side: "left" | "right";
  name: string;
  icon: string;
  odds: string;
}) {
  return (
    <div
      className={clsx(
        "flex-1 flex items-center gap-6 w-full",
        side === "left" && "md:justify-end md:text-right",
      )}
    >
      {side === "right" && (
        <div className="w-16 h-16 rounded-lg bg-surface-container-highest flex items-center justify-center border border-outline-variant/20">
          <span className="material-symbols-outlined filled text-3xl">
            {icon}
          </span>
        </div>
      )}
      <div>
        <h4 className="text-2xl font-headline font-bold">{name}</h4>
        <p
          className={clsx(
            "font-mono text-sm",
            side === "left" ? "text-primary" : "text-tertiary",
          )}
        >
          Odds: {odds}
        </p>
      </div>
      {side === "left" && (
        <div className="w-16 h-16 rounded-lg bg-surface-container-highest flex items-center justify-center border border-outline-variant/20">
          <span className="material-symbols-outlined filled text-3xl">
            {icon}
          </span>
        </div>
      )}
    </div>
  );
}

function WagerControl({ bankroll }: { bankroll: number }) {
  return (
    <div className="glass-panel rounded-xl p-6 border border-outline-variant/20">
      <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary scale-75">
          account_balance_wallet
        </span>
        Bankroll control
      </h3>
      <div className="mb-8">
        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
          Available balance
        </span>
        <div className="text-4xl font-headline font-bold mt-1">
          ₿ {bankroll.toLocaleString()}.00
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="wager"
            className="text-[10px] uppercase font-bold text-on-surface-variant mb-1 block"
          >
            Wager amount
          </label>
          <div className="relative">
            <input
              id="wager"
              name="wager"
              type="number"
              defaultValue={100}
              min={10}
              max={Math.floor(bankroll * 0.5)}
              className="w-full bg-surface-container-highest border-none rounded-lg p-4 text-xl font-headline font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold">
              ₿
            </span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {["Min", "25%", "50%", "Max"].map((l) => (
            <button
              key={l}
              type="button"
              className="bg-surface-container-low hover:bg-surface-container-high py-2 rounded text-[10px] font-bold uppercase border border-outline-variant/20"
            >
              {l}
            </button>
          ))}
        </div>
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex justify-between text-xs font-bold text-on-surface-variant mb-2">
            <span>Est. payout</span>
            <span className="text-primary">+ ₿ 185.00</span>
          </div>
          <div className="h-1 bg-surface-container-low rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[37%]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExposurePanel({ bets }: { bets: ActiveBet[] }) {
  return (
    <div className="glass-panel rounded-xl p-6 border border-outline-variant/20">
      <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-tertiary scale-75">
          history
        </span>
        Live exposure
      </h3>
      <div className="space-y-4">
        {bets.map((b, idx) => (
          <div
            key={idx}
            className={clsx(
              "p-4 rounded-lg bg-surface-container-low border-l-2",
              b.status === "live" ? "border-primary" : "border-outline-variant",
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div
                  className={clsx(
                    "text-[10px] font-bold uppercase",
                    b.status === "live" ? "text-primary" : "text-on-surface",
                  )}
                >
                  {b.team}
                </div>
                <div className="text-xs text-on-surface-variant">
                  vs {b.vs}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-headline font-bold">
                  ₿ {b.stake}
                </div>
                <div className="text-[10px] text-on-surface-variant">
                  {b.odds}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {b.status === "live" ? (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              ) : (
                <span className="material-symbols-outlined text-xs text-outline">
                  schedule
                </span>
              )}
              <span className="text-[10px] font-bold uppercase text-on-surface-variant">
                {b.status === "live" ? "In progress" : "Pending"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="w-full mt-6 py-3 border border-outline-variant/30 rounded-lg text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest transition-colors"
      >
        View betting history
      </button>
    </div>
  );
}
