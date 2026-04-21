import { NextResponse } from "next/server";
import { getAuditState } from "@/server/state";
import { getCurrentParticipant } from "@/server/current-participant";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me || me.role !== "organizer") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const audit = await getAuditState();
  return NextResponse.json(audit, {
    headers: { "Cache-Control": "no-store" },
  });
}
