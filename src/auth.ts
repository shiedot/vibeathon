import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";

const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN?.toLowerCase();

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      hd?: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // Push Google to only offer the allowed workspace domain picker.
          hd: allowedDomain,
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    // Hard-gate: even if a user has a google.com / gmail.com account, reject
    // anything whose id-token `hd` claim (hosted-domain) isn't travelai.com.
    async signIn({ account, profile }) {
      if (!allowedDomain) return true; // no restriction configured
      if (account?.provider !== "google") return false;

      // `profile.hd` is the Google Workspace hosted domain. `email_verified`
      // must also be true. Fall back to splitting the email as a safety net.
      const hd = (profile as { hd?: string } | undefined)?.hd?.toLowerCase();
      const email = (profile?.email ?? "").toLowerCase();
      const emailDomain = email.split("@")[1];

      const emailVerified = (profile as { email_verified?: boolean } | undefined)
        ?.email_verified;
      if (emailVerified === false) return false;

      return hd === allowedDomain || emailDomain === allowedDomain;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
