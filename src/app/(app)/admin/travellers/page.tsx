import { count } from "drizzle-orm";
import { db } from "@/db/client";
import { teams } from "@/db/schema";
import { listTravellers } from "@/server/travellers";
import { TravellersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminTravellersPage() {
  const rows = await listTravellers();
  const [tCount] = await db.select({ c: count() }).from(teams);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Travellers
        </h1>
        <p className="text-on-surface-variant text-sm">
          Manage the roster before Round 1 commits. Remove non-participants,
          audit phantoms, or jump back to Pods to seed.{" "}
          {tCount.c > 0 && (
            <span className="text-tertiary">
              Roster is locked — R1 is committed. Reset tournament to re-edit.
            </span>
          )}
        </p>
      </header>
      <TravellersClient rows={rows} locked={tCount.c > 0} />
    </main>
  );
}
