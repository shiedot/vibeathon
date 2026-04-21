import { getVotingBoothState } from "@/server/voting-booth";
import { VotingBoothClient } from "./client";

export const dynamic = "force-dynamic";

export default async function VotingBoothPage() {
  const initial = await getVotingBoothState();
  return (
    <main className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            <span className="font-label text-xs tracking-[0.2em] uppercase text-tertiary font-bold">
              Live feed
            </span>
          </div>
          <h1 className="font-headline text-4xl md:text-5xl font-black uppercase tracking-tighter">
            Voting Booth
          </h1>
          <p className="text-on-surface-variant text-sm max-w-2xl mt-2">
            Real-time tally for every active battle, plus a streaming feed of
            every vote as it's cast. Put this on the wall during the event.
          </p>
        </div>
      </header>
      <VotingBoothClient initial={initial} />
    </main>
  );
}
