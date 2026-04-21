import { NextResponse, type NextRequest } from "next/server";
import { PID_COOKIE } from "@/server/current-participant";

/**
 * Gate every non-public route behind a picked-participant cookie.
 *
 * No OAuth, no token. If `vibeathon.pid` is set we let the request through —
 * the server components will still re-validate the id against the DB.
 */
export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isPublic =
    pathname === "/signin" ||
    pathname.startsWith("/signin/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/state/spectator") ||
    pathname === "/spectator";

  if (isPublic) return NextResponse.next();

  const pid = req.cookies.get(PID_COOKIE)?.value;
  if (!pid) {
    const signInUrl = new URL("/signin", req.nextUrl);
    signInUrl.searchParams.set("callbackUrl", pathname + (search ?? ""));
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|gif|webp)).*)"],
};
