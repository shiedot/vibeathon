import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, participants, teams, bets } from "@/db/schema";
import { AuditCard } from "./_audit-card";
import { VotingBoothHero } from "./_voting-booth-hero";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [pTotal] = await db
    .select({ c: count() })
    .from(participants)
    .where(sql`${participants.role} = 'participant'`);

  const [tTotal] = await db.select({ c: count() }).from(teams);
  const [tActive] = await db
    .select({ c: count() })
    .from(teams)
    .where(eq(teams.isActive, true));

  const [bPending] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.status, "pending"));
  const [bVoting] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.status, "voting"));
  const [bDead] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.status, "deadlocked"));
  const [bResolved] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.status, "resolved"));

  const [totalBets] = await db.select({ c: count() }).from(bets);

  const tiles: { href: string; icon: string; title: string; body: string }[] = [
    {
      href: "/admin/pods",
      icon: "account_tree",
      title: "Pods & Round 1",
      body: `${pTotal.c} travellers · ${tTotal.c} teams · ${tActive.c} active`,
    },
    {
      href: "/admin/travellers",
      icon: "group",
      title: "Travellers",
      body: `${pTotal.c} on the roster — add, remove, audit`,
    },
    {
      href: "/admin/battles",
      icon: "sports_kabaddi",
      title: "Battles",
      body: `${bPending.c} pending · ${bVoting.c} voting · ${bResolved.c} resolved${bDead.c ? ` · ${bDead.c} deadlocked` : ""}`,
    },
    {
      href: "/admin/betting",
      icon: "monetization_on",
      title: "Bet pools",
      body: `${totalBets.c} bets placed`,
    },
    {
      href: "/admin/play-in",
      icon: "school",
      title: "Play-in",
      body: "Trims the field to 64 — juniors vs senior volunteers. Upset = 500 ₿ Mentor's Honor; loss = 200 ₿ Learner's Bankroll.",
    },
    {
      href: "/admin/timing",
      icon: "schedule",
      title: "Timing",
      body: "Round + betting close",
    },
    {
      href: "/admin/overrides",
      icon: "tune",
      title: "Overrides",
      body: "Bankroll, pots, battle reversals",
    },
    {
      href: "/admin/settlement",
      icon: "receipt_long",
      title: "Settlement",
      body: "Finalize + CSV export",
    },
    {
      href: "/admin/bankroll",
      icon: "account_balance_wallet",
      title: "Bankroll",
      body: "Live per-participant",
    },
    {
      href: "/admin/audit",
      icon: "fact_check",
      title: "Audit",
      body: "Money conservation",
    },
  ];

  return (
    <main className="space-y-8">
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
      </header>

      <VotingBoothHero />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group bg-surface-container-low hover:bg-surface-container p-6 rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined filled text-primary">
                {t.icon}
              </span>
              <span className="material-symbols-outlined text-xs text-outline">
                arrow_forward
              </span>
            </div>
            <h3 className="font-headline text-lg font-bold mb-1">{t.title}</h3>
            <p className="text-sm text-on-surface-variant leading-snug">
              {t.body}
            </p>
          </Link>
        ))}
      </section>

      <AuditCard />
    </main>
  );
}
