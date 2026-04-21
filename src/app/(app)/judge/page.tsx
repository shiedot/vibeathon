import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { battles, coachNominations } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function JudgeOverviewPage() {
  const [dead] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.status, "deadlocked"));
  const [sfFinal] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.roundNumber, 5));
  const [coachTotal] = await db.select({ c: count() }).from(coachNominations);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Judge console
        </h1>
      </header>
      <section className="grid md:grid-cols-3 gap-4">
        <Tile
          href="/judge/deadlocks"
          icon="gavel"
          title={`${dead.c} deadlocked`}
          body="Step in with a call, a coin flip, or DQ both."
        />
        <Tile
          href="/judge/vote"
          icon="how_to_vote"
          title="SF + Final votes"
          body={`${sfFinal.c} SF battles to watch.`}
        />
        <Tile
          href="/judge/coaches"
          icon="volunteer_activism"
          title={`${coachTotal.c} coach nominations`}
          body="Aggregated counts + reasons."
        />
      </section>
    </main>
  );
}

function Tile(props: { href: string; icon: string; title: string; body: string }) {
  return (
    <Link
      href={props.href}
      className="bg-surface-container-low hover:bg-surface-container p-6 rounded-xl border border-outline-variant/10"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="material-symbols-outlined filled text-primary">
          {props.icon}
        </span>
        <span className="material-symbols-outlined text-xs text-outline">
          arrow_forward
        </span>
      </div>
      <div className="font-headline font-bold text-lg">{props.title}</div>
      <div className="text-xs text-on-surface-variant mt-1">{props.body}</div>
    </Link>
  );
}
