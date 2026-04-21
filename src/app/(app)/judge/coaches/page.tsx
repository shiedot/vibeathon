import { aggregateForJudges } from "@/server/nominations";

export const dynamic = "force-dynamic";

export default async function JudgeCoachesPage() {
  const summary = await aggregateForJudges();
  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Coach nominations
        </h1>
        <p className="text-on-surface-variant text-sm">
          Aggregated per nominee. Reasons are visible only to judges.
        </p>
      </header>
      {summary.length === 0 && (
        <div className="rounded-lg bg-surface-container-low p-4 text-on-surface-variant text-sm">
          No nominations yet.
        </div>
      )}
      <div className="space-y-3">
        {summary.map((s) => (
          <details
            key={s.nomineeId}
            className="rounded-xl bg-surface-container-low border border-outline-variant/10"
          >
            <summary className="cursor-pointer p-4 flex items-center justify-between">
              <div>
                <div className="font-headline font-bold text-lg">{s.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mt-0.5">
                  {s.nomineeId}
                </div>
              </div>
              <div className="font-headline font-black text-2xl text-primary">
                {s.count}
              </div>
            </summary>
            <ul className="border-t border-outline-variant/10 divide-y divide-outline-variant/5">
              {s.reasons.map((r, i) => (
                <li key={i} className="p-3 text-sm">
                  “{r}”
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </main>
  );
}
