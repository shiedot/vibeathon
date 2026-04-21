import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/server/current-participant";
import { rosterCsvTemplate } from "@/server/ingest";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me || me.role !== "organizer") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  return new NextResponse(rosterCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="vibeathon-roster-template.csv"`,
    },
  });
}
