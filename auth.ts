/**
 * Internal login only — not public signup. Google is the identity
 * provider, but signing in with Google alone isn't enough: the signIn
 * callback below checks the email against ALLOWED_EMAILS. If that env
 * var isn't set, access is denied by default (fail closed), not opened
 * to anyone with a Google account.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Explicit names rather than NextAuth v5's AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET
  // auto-inference, to match the GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/
  // NEXTAUTH_SECRET vars already set up in Vercel.
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true, // Vercel sits behind a proxy; needed to avoid UntrustedHost errors
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const allowed = allowedEmails();
      if (allowed.length === 0) return false; // unconfigured — deny, don't default-open
      return !!user.email && allowed.includes(user.email.toLowerCase());
    },
    async session({ session }) {
      return session;
    },
  },
});
