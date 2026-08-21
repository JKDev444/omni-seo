import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Uses the Edge-safe config only — no Prisma import reaches this file,
// directly or transitively. See auth.config.ts for why that matters.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Cron routes authenticate via CRON_SECRET (Vercel's trigger sends a
  // Bearer token, not a browser session cookie) -- redirecting them into
  // the login-page flow like every other route meant the cron job could
  // never actually reach its handler at all, confirmed by testing the
  // real endpoint locally before deploying.
  if (req.nextUrl.pathname.startsWith("/api/cron/")) return;

  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/action-plan", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
