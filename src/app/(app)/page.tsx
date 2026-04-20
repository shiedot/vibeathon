import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="px-6 max-w-7xl mx-auto space-y-8">
      {/* Hero / Round Counter */}
      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 md:p-12 border-l-2 border-primary shadow-[0_0_20px_rgba(69,237,207,0.15)]">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,var(--color-primary),transparent_70%)]" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em] text-primary-fixed-dim font-bold mb-2 block">
              Current Engagement
            </span>
            <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
              Round 1 <br />
              <span className="text-outline">Solo Sprint</span>
            </h1>
          </div>
          <CountdownCard hours={4} minutes={42} seconds={18} />
        </div>
      </section>

      {/* Bankroll + Traveler test */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-panel p-8 rounded-xl border border-outline-variant/20 relative overflow-hidden group">
          <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <span className="material-symbols-outlined text-[120px]">
              account_balance_wallet
            </span>
          </div>
          <div className="flex justify-between items-start mb-12">
            <div>
              <h3 className="font-label text-xs uppercase tracking-widest text-gray-400 mb-1">
                Financial HUD
              </h3>
              <p className="font-headline text-2xl font-bold">
                Portfolio Overview
              </p>
            </div>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter">
              Live Sync
            </span>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <BankrollStat
              label="Personal Bankroll"
              amount="1,000 ₿"
              accent="primary"
              icon="trending_up"
            />
            <BankrollStat
              label="Team Pot"
              amount="1,000 ₿"
              accent="tertiary"
              icon="group"
              border
            />
          </div>
        </div>

        <div className="bg-tertiary-container/10 p-8 rounded-xl border border-tertiary/20 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-tertiary/20 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-tertiary">
                explore
              </span>
            </div>
            <h3 className="font-headline text-xl font-bold text-tertiary uppercase tracking-tight mb-4">
              The Traveler Test
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
              &ldquo;How does this serve the Traveler?&rdquo;
            </p>
            <p className="text-[11px] mt-4 text-gray-500 leading-snug">
              If the Traveler were sitting next to you right now, would they be
              glad you built this? If no, change it. If yes, ship it.
            </p>
          </div>
          <Link
            href="/about"
            className="mt-8 text-[10px] uppercase tracking-widest font-bold text-tertiary flex items-center gap-2 hover:gap-4 transition-all"
          >
            Review core values
            <span className="material-symbols-outlined text-xs">
              arrow_forward
            </span>
          </Link>
        </div>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLink
          href="/bracket"
          icon="account_tree"
          label="Global Bracket"
          hint="64 \u2192 32 \u2192 16 \u2192 8 \u2192 4 \u2192 2 \u2192 1"
        />
        <QuickLink
          href="/betting"
          icon="monetization_on"
          label="Betting Floor"
          hint="Parimutuel pool, half-round bet close"
        />
        <QuickLink
          href="/prizes"
          icon="emoji_events"
          label="Prize Ledger"
          hint="₿16,777 Grand Champion pot + ৳292,800 named"
        />
      </section>

      {/* Live pulse */}
      <section>
        <h2 className="font-label text-xs uppercase tracking-[0.3em] font-black mb-6 text-gray-500">
          Live Network Pulse
        </h2>
        <div className="space-y-3">
          <PulseItem
            time="14:22:01"
            accent="primary"
            text={
              <>
                Player <span className="text-primary">k0de_wizard</span> placed
                a 250 ₿ bet on Round 1
              </>
            }
            status="Verified"
          />
          <PulseItem
            time="14:18:45"
            accent="tertiary"
            text={
              <>
                Team <span className="text-tertiary">Nebula</span> submitted a
                new build for &lsquo;Traveler Test&rsquo;
              </>
            }
            status="Pending Review"
          />
        </div>
      </section>
    </main>
  );
}

function CountdownCard(props: {
  hours: number;
  minutes: number;
  seconds: number;
}) {
  return (
    <div className="bg-surface-container-highest/50 backdrop-blur-md p-6 rounded-lg border border-outline-variant/30 min-w-[260px]">
      <span className="font-label text-[10px] uppercase tracking-widest text-gray-400 mb-4 block">
        Submission closes in
      </span>
      <div className="flex gap-4 font-headline text-3xl font-bold">
        {(
          [
            ["Hours", props.hours],
            ["Mins", props.minutes],
            ["Secs", props.seconds],
          ] as const
        ).map(([label, value], idx) => (
          <div key={label} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <span>{String(value).padStart(2, "0")}</span>
              <span className="text-[10px] uppercase text-primary tracking-tighter">
                {label}
              </span>
            </div>
            {idx < 2 && <span className="text-outline-variant">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function BankrollStat(props: {
  label: string;
  amount: string;
  accent: "primary" | "tertiary";
  icon: string;
  border?: boolean;
}) {
  const color = props.accent === "primary" ? "text-primary" : "text-tertiary";
  return (
    <div
      className={`space-y-1 ${props.border ? "border-l border-outline-variant/30 pl-8" : ""}`}
    >
      <span className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">
        {props.label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`font-headline text-4xl font-black ${color}`}>
          {props.amount}
        </span>
        <span className={`material-symbols-outlined text-sm ${color}`}>
          {props.icon}
        </span>
      </div>
    </div>
  );
}

function QuickLink(props: {
  href: string;
  icon: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={props.href}
      className="group flex items-center justify-between p-5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest transition-colors border border-transparent hover:border-primary/30"
    >
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined filled text-primary">
          {props.icon}
        </span>
        <div>
          <div className="font-headline font-bold text-sm uppercase">
            {props.label}
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">
            {props.hint}
          </div>
        </div>
      </div>
      <span className="material-symbols-outlined text-gray-600 group-hover:text-primary transition-colors">
        chevron_right
      </span>
    </Link>
  );
}

function PulseItem(props: {
  time: string;
  accent: "primary" | "tertiary";
  text: React.ReactNode;
  status: string;
}) {
  const border =
    props.accent === "primary" ? "border-primary/40" : "border-tertiary/40";
  const timeColor =
    props.accent === "primary" ? "text-primary" : "text-tertiary";
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg bg-surface-container-low border-l-2 ${border}`}
    >
      <div className="flex items-center gap-4">
        <span className={`text-[10px] font-mono ${timeColor} opacity-50`}>
          {props.time}
        </span>
        <p className="text-sm font-medium">{props.text}</p>
      </div>
      <span className="text-[10px] uppercase font-bold text-gray-600">
        {props.status}
      </span>
    </div>
  );
}
