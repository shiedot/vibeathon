import Link from "next/link";

export function VotingBoothHero() {
  return (
    <Link
      href="/admin/voting-booth"
      className="group relative overflow-hidden block rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface-container-low to-surface-container-low p-6 md:p-8 hover:border-primary/60 transition-colors"
    >
      <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        <span className="material-symbols-outlined text-[200px] leading-none">
          how_to_vote
        </span>
      </div>
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-label text-[10px] tracking-[0.2em] uppercase text-primary font-bold">
              Live
            </span>
          </div>
          <div className="font-headline text-2xl md:text-3xl font-black uppercase tracking-tighter">
            View the live Voting Booth
          </div>
          <p className="text-sm text-on-surface-variant leading-snug">
            Real-time tally for every active battle, plus a streaming feed of
            every vote as it's cast — names in green for Team A, red for Team
            B, newest on top. Put it on the wall during the event.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-widest">
            Open booth
            <span className="material-symbols-outlined text-base">
              arrow_forward
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
