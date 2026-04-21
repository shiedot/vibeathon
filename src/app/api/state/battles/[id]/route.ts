import { NextResponse } from "next/server";
import { getBattleState } from "@/server/state";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const state = await getBattleState(id);
  if (!state) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
