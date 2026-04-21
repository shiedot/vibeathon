import { NextResponse } from "next/server";
import { getLeaderboards } from "@/server/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getLeaderboards();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
