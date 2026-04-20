import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Gate every non-public route behind a valid session. `auth()` returns the
 * current session or null; unauthenticated requests get bounced to /signin
 * with a `callbackUrl` so they come back to where they were.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);

  // Public routes — don't force auth on these.
  const isPublic =
    pathname === "/signin" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  if (!isLoggedIn) {
    const signInUrl = new URL("/signin", req.nextUrl);
    signInUrl.searchParams.set("callbackUrl", pathname + (search ?? ""));
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Run middleware everywhere except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|gif|webp)).*)"],
};
