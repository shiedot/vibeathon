import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { PID_COOKIE } from "@/server/current-participant";
import { consumeMagicLink } from "@/server/magic-link";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const base = req.nextUrl;

  const result = await consumeMagicLink(token);
  if (!result) {
    const err = new URL("/signin", base);
    err.searchParams.set("error", "expired");
    return NextResponse.redirect(err);
  }

  const callback = result.callbackUrl || "/";
  const safeCallback =
    callback.startsWith("/") && !callback.startsWith("//") ? callback : "/";
  const dest = new URL(safeCallback, base);

  const store = await cookies();
  store.set(PID_COOKIE, result.participant.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });

  return NextResponse.redirect(dest);
}
