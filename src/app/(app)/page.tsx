import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getCurrentParticipant } from "@/server/current-participant";
import { db } from "@/db/client";
import { bankrollLedger, roundConfig } from "@/db/schema";
import { Countdown } from "@/components/countdown";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const me = await getCurrentParticipant();
  if (!me) return null; // layout guard handles redirect

  const [currentRound] = await db
    .select()
    .from(roundConfig)
    .orderBy(desc(roundConfig.roundNumber))
    .limit(1);

  const recentLedger = await db
    .select({
      id: bankrollLedger.id,
      kind: bankrollLedger.kind,
      delta: bankrollLedger.delta,
      reason: bankrollLedger.reason,
      createdAt: bankrollLedger.createdAt,
    })
    .from(bankrollLedger)
    .where(eq(bankrollLedger.participantId, me.participant.id))
    .orderBy(desc(bankrollLedger.createdAt))
    .limit(8);

  return (
    <main className="px-6 max-w-7xl mx-auto space-y-8">
      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-8 md:p-12 border-l-2 border-primary shadow-[0_0_20px_rgba(69,237,207,0.15)]">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,var(--color-primary),transparent_70%)]" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em] text-primary-fixed-dim font-bold mb-2 block">
              {currentRound ? "Current round" : "Pre-event"}
            </span>
            <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
              {currentRound ? currentRound.label : "Awaiting kickoff"}
            </h1>
          </div>
          <div className="bg-surface-container-highest/50 backdrop-blur-md p-6 rounded-lg border border-outline-variant/30 min-w-[260px]">
            <Countdown
              target={currentRound?.endsAt ?? null}
              label="Round ends in"
            />
          </div>
        </div>
      </section>

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
                {me.participant.name}
              </h3>
              <p className="font-headline text-2xl font-bold">
                Portfolio overview
              </p>
            </div>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter">
              Live sync
            </span>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <BankrollStat
              label="Personal bankroll"
              amount={`${me.participant.personalBankroll.toLocaleString()} ₿`}
              accent="primary"
              icon="trending_up"
            />
            <BankrollStat
              label="Setup status"
              amount={me.participant.setupStatus.replace("_", " ")}
              accent="tertiary"
              icon={
                me.participant.setupStatus === "ready"
                  ? "verified"
                  : "pending_actions"
              }
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
            href="/nominate"
            className="mt-8 text-[10px] uppercase tracking-widest font-bold text-tertiary flex items-center gap-2 hover:gap-4 transition-all"
          >
            Nominate your coach
            <span className="material-symbols-outlined text-xs">
              arrow_forward
            </span>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QuickLink
          href="/matchup"
          icon="stadium"
          label="My matchup"
          hint="Live head-to-head"
        />
        <QuickLink
          href="/bracket"
          icon="account_tree"
          label="Bracket"
          hint="Full tournament tree"
        />
        <QuickLink
          href="/betting"
          icon="monetization_on"
          label="Betting"
          hint="Parimutuel, halfway cutoff"
        />
        <QuickLink
          href="/history"
          icon="receipt_long"
          label="My ledger"
          hint="Every ₿ movement"
        />
      </section>

      <section>
        <h2 className="font-label text-xs uppercase tracking-[0.3em] font-black mb-6 text-gray-500">
          Recent ₿ movement
        </h2>
        {recentLedger.length === 0 ? (
          <div className="p-6 rounded-lg bg-surface-container-low text-on-surface-variant text-sm">
            No ledger entries yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recentLedger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 rounded-lg bg-surface-container-low border-l-2 border-primary/40"
              >
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                    {entry.kind.replace("_", " ")}
                  </div>
                  <div className="text-sm font-medium mt-1">{entry.reason}</div>
                </div>
                <div
                  className={`font-headline text-xl font-bold tabular-nums ${
                    entry.delta >= 0 ? "text-primary" : "text-tertiary"
                  }`}
                >
                  {entry.delta >= 0 ? "+" : ""}
                  {entry.delta.toLocaleString()} ₿
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
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
