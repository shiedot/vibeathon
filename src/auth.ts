import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accounts,
  authenticators,
  participants,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";

const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN?.toLowerCase();

function organizerEmails(): Set<string> {
  return new Set(
    (process.env.ORGANIZER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      hd?: string | null;
      role?: "participant" | "organizer" | "judge";
      participantId?: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
          ...(allowedDomain ? { hd: allowedDomain } : {}),
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
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const emailVerified = (profile as { email_verified?: boolean } | undefined)
        ?.email_verified;
      if (emailVerified === false) return false;

      const email = (profile?.email ?? "").toLowerCase();
      const hd = (profile as { hd?: string } | undefined)?.hd?.toLowerCase();
      const emailDomain = email.split("@")[1];

      if (organizerEmails().has(email)) return true;
      if (!allowedDomain) return true;
      return hd === allowedDomain || emailDomain === allowedDomain;
    },
    async session({ session, user }) {
      session.user.id = user.id;

      const email = (user.email ?? "").toLowerCase();
      const orgSet = organizerEmails();

      // Try to link / load the participant row.
      const rows = await db
        .select()
        .from(participants)
        .where(eq(participants.email, email))
        .limit(1);

      if (rows.length === 0) {
        const isOrganizer = orgSet.has(email);
        const inserted = await db
          .insert(participants)
          .values({
            name: user.name ?? email,
            email,
            department: isOrganizer ? "Organizer" : "Traveller",
            employeeId: `auto-${user.id}`.slice(0, 64),
            role: isOrganizer ? "organizer" : "participant",
            setupStatus: "ready",
            personalBankroll: isOrganizer ? 0 : 1000,
            userId: user.id,
          })
          .returning();
        session.user.role = isOrganizer ? "organizer" : "participant";
        session.user.participantId = inserted[0]?.id ?? null;
        return session;
      }

      const participant = rows[0];
      if (participant.userId !== user.id) {
        await db
          .update(participants)
          .set({ userId: user.id })
          .where(eq(participants.id, participant.id));
      }

      // Force organizer role if email is in ORGANIZER_EMAILS.
      if (orgSet.has(email) && participant.role !== "organizer") {
        await db
          .update(participants)
          .set({ role: "organizer" })
          .where(eq(participants.id, participant.id));
        session.user.role = "organizer";
      } else {
        session.user.role = participant.role;
      }
      session.user.participantId = participant.id;
      return session;
    },
  },
});
