import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/server/current-participant";
import { getVotingBoothState } from "@/server/voting-booth";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me || (me.role !== "organizer" && me.role !== "judge")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const state = await getVotingBoothState();
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
