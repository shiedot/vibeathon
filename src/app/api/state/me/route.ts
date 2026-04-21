import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/server/current-participant";
import { getMeState } from "@/server/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const state = await getMeState(me.participant.id);
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
