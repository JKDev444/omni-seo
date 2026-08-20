/**
 * Edge-safe base config, shared by middleware.ts and auth.ts. Deliberately
 * has NO providers here — Credentials' authorize() imports Prisma Client,
 * which cannot run on Vercel's Edge Runtime (where middleware runs).
 * Middleware only needs to read the session JWT, never run authorize().
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true, // Vercel sits behind a proxy; needed to avoid UntrustedHost errors
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
};
