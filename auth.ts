/**
 * Full auth config, used by the /api/auth route handler and server
 * actions (both run in the Node.js runtime, not Edge — safe for Prisma).
 * middleware.ts deliberately does NOT import this file — see
 * auth.config.ts for why.
 *
 * Internal login only — username/password, no public signup route. The
 * User table itself is the allowlist: only accounts created via
 * scripts/createUser.ts can log in. No Google dependency for login —
 * Google (service accounts / a one-time GBP connect flow) is only used
 * later for pulling GSC/GA4/GBP data, decoupled from how staff sign in.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !verifyPassword(password, user.passwordHash)) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
});
