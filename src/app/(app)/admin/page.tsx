import Link from "next/link";

const SECTIONS = [
  {
    href: "/admin/roster",
    icon: "groups",
    title: "Roster & setup gating",
    body: "Ingest CSV, flag incomplete setup, run the Y/N gate before R1 can start.",
    status: "Stub",
  },
  {
    href: "/admin/play-in",
    icon: "school",
    title: "Play-in pairing",
    body: "Sort juniors + senior volunteers and generate David-vs-Goliath matchups.",
    status: "Stub",
  },
  {
    href: "/admin/pods",
    icon: "account_tree",
    title: "Pod assignment + R1",
    body: "Snake-draft by experience score into 8 pods of 8 and randomize R1 matchups.",
    status: "Stub",
  },
  {
    href: "/admin/battles",
    icon: "sports_kabaddi",
    title: "Battle lifecycle",
    body: "Start, open voting, record result, or trigger judge intervention per battle.",
    status: "Stub",
  },
  {
    href: "/admin/bankroll",
    icon: "account_balance_wallet",
    title: "Bankroll & pot audit",
    body: "Live view of personal bankrolls, team pots, and money-conservation ledger.",
    status: "Stub",
  },
  {
    href: "/admin/betting",
    icon: "monetization_on",
    title: "Bet pools + close",
    body: "Monitor parimutuel pools, halfway close countdowns, lock bets, settle payouts.",
    status: "Stub",
  },
  {
    href: "/admin/nominations",
    icon: "groups",
    title: "Best Coach nominations",
    body: "Judge-only aggregated view of nominees, counts, and reasons.",
    status: "Stub",
  },
  {
    href: "/admin/settlement",
    icon: "receipt_long",
    title: "Final settlement",
    body: "Compute prize ledger per Traveller, assign redemption method, export.",
    status: "Stub",
  },
];

export default function AdminPage() {
  return (
    <main className="px-6 max-w-7xl mx-auto space-y-10">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
          <span className="font-label text-xs tracking-[0.2em] uppercase text-tertiary font-bold">
            Organizer console
          </span>
        </div>
        <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter uppercase">
          Admin
        </h1>
        <p className="text-on-surface-variant mt-3 max-w-2xl">
          Control surfaces for Wednesday setup through Friday settlement. Each
          section below is a scaffolded route ready to be wired to the
          appropriate server actions and Drizzle queries.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group bg-surface-container-low hover:bg-surface-container p-6 rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined filled text-primary">
                {s.icon}
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                {s.status}
              </span>
            </div>
            <h3 className="font-headline text-lg font-bold mb-2">{s.title}</h3>
            <p className="text-sm text-on-surface-variant leading-snug">
              {s.body}
            </p>
            <div className="mt-4 text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-2 group-hover:gap-4 transition-all">
              Open
              <span className="material-symbols-outlined text-xs">
                arrow_forward
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
