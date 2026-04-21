import { NextResponse } from "next/server";
import { getBracket } from "@/server/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const bracket = await getBracket();
  return NextResponse.json(bracket, {
    headers: { "Cache-Control": "no-store" },
  });
}
