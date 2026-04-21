import { getCurrentParticipant } from "@/server/current-participant";
import { listMyNominations } from "@/server/nominations";
import { NominateForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NominatePage() {
  const me = await getCurrentParticipant();
  if (!me) return null;
  const mine = await listMyNominations(me.participant.id);

  return (
    <main className="px-6 max-w-3xl mx-auto space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
          <span className="font-label text-xs uppercase tracking-[0.2em] text-tertiary font-bold">
            Best Coach
          </span>
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-black uppercase tracking-tighter">
          Nominate your coach
        </h1>
        <p className="mt-3 text-on-surface-variant text-sm max-w-xl">
          Up to 3 Travellers across the event. Judges see aggregate counts +
          reasons. The nominator is private.
        </p>
      </header>

      <NominateForm remaining={3 - mine.length} />

      <section>
        <h2 className="text-xs uppercase tracking-widest font-bold text-on-surface-variant mb-3">
          Your nominations ({mine.length}/3)
        </h2>
        {mine.length === 0 && (
          <div className="rounded-lg bg-surface-container-low p-4 text-on-surface-variant text-sm">
            You haven&apos;t nominated anyone yet.
          </div>
        )}
        <div className="space-y-2">
          {mine.map((n) => (
            <div
              key={n.id}
              className="rounded-lg bg-surface-container-low p-4 border-l-2 border-tertiary/30"
            >
              <div className="text-sm font-medium">{n.reason}</div>
              <div className="text-[10px] text-on-surface-variant mt-1">
                {new Date(n.submittedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
