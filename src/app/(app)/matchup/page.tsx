import { clsx } from "clsx";

type TeamSide = "a" | "b";

type TeamMember = {
  handle: string;
  role: string;
  verified?: boolean;
};

type TeamCard = {
  side: TeamSide;
  name: string;
  seed: number;
  winRate: number;
  pitchTitle: string;
  pitch: string;
  members: TeamMember[];
};

const TEAM_A: TeamCard = {
  side: "a",
  name: "My Team",
  seed: 4,
  winRate: 74,
  pitchTitle: "Our Traveler pitch",
  pitch:
    "Offline-first itinerary memory for drivers navigating rural Bangladesh. Works at 2G, serves the Traveler even when the cloud doesn't.",
  members: [
    { handle: "DR0ID_MAREK", role: "Lead Architect", verified: true },
    { handle: "LUNA.PX", role: "Visual Strategist", verified: true },
  ],
};

const TEAM_B: TeamCard = {
  side: "b",
  name: "The OPFOR",
  seed: 1,
  winRate: 26,
  pitchTitle: "The counter-strike",
  pitch:
    "AI concierge that rewrites broken plans in-flight. Missed connections, closed venues, weather — the Traveler never hits a dead end.",
  members: [
    { handle: "KRYPT0_KING", role: "Smart Contract Wizard" },
    { handle: "HEX_GIRL", role: "Fullstack Enforcer" },
  ],
};

export default function MatchupPage() {
  return (
    <main className="px-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-label text-xs tracking-[0.2em] uppercase text-surface-tint font-bold">
              Live Battle: Quarter-Finals
            </span>
          </div>
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter leading-none italic uppercase">
            The Kinetic <br />
            <span className="text-primary">Showdown</span>
          </h1>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="font-label text-xs tracking-[0.1em] text-on-surface-variant uppercase">
            Current stakes
          </div>
          <div className="bg-tertiary-container/20 border-l-4 border-tertiary p-4 rounded-r-xl glass-panel">
            <div className="font-headline text-3xl font-bold text-tertiary tracking-tight">
              4,096 ₿{" "}
              <span className="text-on-surface">+ Captaincy</span>
            </div>
            <div className="text-xs text-on-tertiary-container/80 mt-1 uppercase font-semibold">
              Winner takes 80% into Round 4 pot
            </div>
          </div>
        </div>
      </header>

      {/* Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <TeamPanel team={TEAM_A} />

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

        <TeamPanel team={TEAM_B} />
      </div>

      {/* Stats / ledger */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/10 glass-panel">
          <h3 className="font-headline text-lg font-bold text-on-surface uppercase mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              analytics
            </span>
            Live matchup stats
          </h3>
          <div className="space-y-6">
            <StatBar label="Development velocity" value={89} accent="primary" />
            <StatBar label="Pitch sentiment" value={62} accent="tertiary" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-9xl">
              emoji_events
            </span>
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface uppercase mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary">
              trophy
            </span>
            The winner&apos;s ledger
          </h3>
          <ul className="space-y-4">
            <li className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
              <span className="font-label text-sm uppercase font-semibold">
                Team pot (80%)
              </span>
              <span className="bg-tertiary-container/30 px-3 py-1 rounded text-tertiary font-headline font-bold">
                ₿ 3,277
              </span>
            </li>
            <li className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low opacity-50">
              <span className="font-label text-sm uppercase font-semibold">
                Loser captain (20%)
              </span>
              <span className="bg-surface-container-highest px-3 py-1 rounded text-on-surface-variant font-headline font-bold">
                ₿ 819
              </span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function TeamPanel({ team }: { team: TeamCard }) {
  const isA = team.side === "a";
  const accentBorder = isA ? "border-primary" : "border-tertiary";
  const accentText = isA ? "text-primary" : "text-tertiary";
  const pitchBorder = isA ? "border-l-2 border-primary" : "border-r-2 border-tertiary";
  const pitchAlign = isA ? "" : "text-right";
  const seedTone = isA
    ? "bg-primary/10 border-primary/20 text-primary"
    : "bg-tertiary/10 border-tertiary/20 text-tertiary";
  const voteBtn = isA
    ? "kinetic-gradient text-on-primary"
    : "bg-surface-container-highest border border-outline-variant hover:border-tertiary/50 text-on-surface";
  const voteIcon = isA ? "rocket_launch" : "stadium";

  return (
    <section className="lg:col-span-5 space-y-6">
      <div className="relative group">
        <div
          className={clsx(
            "absolute -inset-0.5 opacity-20 group-hover:opacity-40 transition-opacity rounded-xl",
            isA
              ? "bg-gradient-to-r from-primary to-transparent"
              : "bg-gradient-to-l from-tertiary to-transparent",
          )}
        />
        <div className="relative bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
          <div
            className={clsx(
              "flex items-start mb-8",
              isA ? "justify-between" : "justify-between flex-row-reverse",
            )}
          >
            <h2 className="font-headline text-3xl font-black italic text-on-surface uppercase">
              {team.name}
            </h2>
            <div
              className={clsx(
                "px-3 py-1 border rounded-full text-[10px] font-bold uppercase tracking-widest",
                seedTone,
              )}
            >
              Seed #{String(team.seed).padStart(2, "0")}
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {team.members.map((m) => (
              <MemberRow key={m.handle} member={m} align={isA ? "left" : "right"} />
            ))}
          </div>

          <div
            className={clsx(
              "bg-surface-container-high/50 p-6 rounded-lg",
              pitchBorder,
              pitchAlign,
            )}
          >
            <div
              className={clsx(
                "text-[10px] font-bold uppercase tracking-widest mb-2",
                accentText,
              )}
            >
              {team.pitchTitle}
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed font-light">
              {team.pitch}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          className={clsx(
            "w-full py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform",
            voteBtn,
          )}
        >
          <span className="material-symbols-outlined filled">{voteIcon}</span>
          <span className="font-headline font-black uppercase tracking-tight">
            {isA ? "Vote my team" : "Vote opponent"}
          </span>
        </button>
        <div className="text-center font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
          {team.winRate}% Consensus win rate
        </div>
      </div>
      <div className={accentBorder} aria-hidden />
    </section>
  );
}

function MemberRow({
  member,
  align,
}: {
  member: TeamMember;
  align: "left" | "right";
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-4 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center">
        <span className="material-symbols-outlined text-on-surface-variant">
          person
        </span>
      </div>
      <div className={align === "right" ? "ml-auto" : ""}>
        <div className="font-headline font-bold text-on-surface">
          {member.handle}
        </div>
        <div className="text-xs text-on-surface-variant font-label uppercase tracking-tighter">
          {member.role}
        </div>
      </div>
      {member.verified && (
        <span
          className={clsx(
            "material-symbols-outlined filled text-primary text-sm",
            align === "left" && "ml-auto",
          )}
        >
          verified
        </span>
      )}
    </div>
  );
}

function StatBar({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "primary" | "tertiary";
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
        <span>{label}</span>
        <span className={accent === "primary" ? "text-primary" : "text-tertiary"}>
          {value}%
        </span>
      </div>
      <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className={clsx(
            "h-full",
            accent === "primary" ? "kinetic-gradient" : "bg-tertiary",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
