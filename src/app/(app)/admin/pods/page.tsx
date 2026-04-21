import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, teams } from "@/db/schema";
import { PodsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminPodsPage() {
  const [tCount] = await db.select({ c: count() }).from(teams);
  const [bCount] = await db
    .select({ c: count() })
    .from(battles)
    .where(eq(battles.roundNumber, 1));

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Pods &amp; R1
        </h1>
        <p className="text-on-surface-variant text-sm">
          Preview a seeded bracket, then commit teams + R1 battles.{" "}
          {tCount.c > 0 && (
            <span className="text-tertiary">
              {tCount.c} teams and {bCount.c} R1 battles already exist — reset
              before re-running.
            </span>
          )}
        </p>
      </header>
      <PodsClient alreadyCommitted={tCount.c > 0} />
    </main>
  );
}
