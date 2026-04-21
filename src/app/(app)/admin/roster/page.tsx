import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { RosterClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminRosterPage() {
  const rows = await db
    .select()
    .from(participants)
    .orderBy(desc(participants.createdAt));

  return (
    <main className="space-y-6">
      <header>
        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter">
          Roster
        </h1>
        <p className="text-on-surface-variant text-sm">
          Upload a CSV to ingest participants. Mark setup complete to unlock
          R1.
        </p>
      </header>
      <RosterClient
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          department: r.department,
          employeeId: r.employeeId,
          role: r.role,
          setupStatus: r.setupStatus,
          yearsCoding: r.yearsCoding,
          comfortLevel: r.comfortLevel,
          completedTestPr: r.completedTestPr,
        }))}
      />
    </main>
  );
}
