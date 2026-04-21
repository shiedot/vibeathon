import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/server/current-participant";
import { searchParticipants } from "@/server/nominations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const me = await getCurrentParticipant();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const rows = await searchParticipants(q);
  // Exclude self from results.
  return NextResponse.json(rows.filter((r) => r.id !== me.participant.id), {
    headers: { "Cache-Control": "no-store" },
  });
}
