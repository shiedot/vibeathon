import { desc, eq } from "drizzle-orm";
import { getCurrentParticipant } from "@/server/current-participant";
import { db } from "@/db/client";
import { bankrollLedger } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const me = await getCurrentParticipant();
  if (!me) return null;
  const rows = await db
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
    .limit(200);

  return (
    <main className="px-6 max-w-4xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="font-label text-xs uppercase tracking-[0.2em] text-primary font-bold">
            My ledger
          </span>
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-black uppercase tracking-tighter">
          Every ₿ movement
        </h1>
      </header>

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="p-6 rounded-lg bg-surface-container-low text-on-surface-variant text-sm">
            No entries yet.
          </div>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between p-4 rounded-lg bg-surface-container-low border-l-2 border-primary/30"
          >
            <div>
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                {r.kind.replace("_", " ")}
              </div>
              <div className="text-sm font-medium mt-1">{r.reason}</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">
                {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>
            <div
              className={`font-headline text-xl font-bold tabular-nums ${
                r.delta >= 0 ? "text-primary" : "text-tertiary"
              }`}
            >
              {r.delta >= 0 ? "+" : ""}
              {r.delta.toLocaleString()} ₿
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
