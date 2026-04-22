/**
 * Cookie-based "auth" for the friendly-hackathon build.
 *
 * There is no password or SSO. Participants pick themselves from a dropdown
 * on /signin and we store their participant id in the `vibeathon.pid` cookie.
 * Admin-console access is gated by a shared password cookie (`vibeathon.admin`
 * — see `@/server/admin-auth`). This is explicitly *not* secure against a
 * motivated cheater — it's a friction-free entry flow for an internal event.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { participants, type Participant } from "@/db/schema";
import { isAdminAuthed } from "./admin-auth";

export const PID_COOKIE = "vibeathon.pid";

export type AuthedParticipant = {
  participant: Participant;
  /**
   * Audit-tag value stored on ledger rows. Always set to the participant id
   * (we no longer have a separate users table). Kept as a string for drop-in
   * compatibility with the many callers that thread `me.userId` through.
   */
  userId: string;
  role: "participant" | "organizer" | "judge";
  isAdmin: boolean;
};

export const getCurrentParticipant = cache(
  async (): Promise<AuthedParticipant | null> => {
    const store = await cookies();
    const pid = store.get(PID_COOKIE)?.value;
    if (!pid) return null;

    const rows = await db
      .select()
      .from(participants)
      .where(eq(participants.id, pid))
      .limit(1);
    if (rows.length === 0) return null;

    const p = rows[0];
    const admin = await isAdminAuthed();
    return {
      participant: p,
      userId: p.id,
      role: p.role,
      isAdmin: admin,
    };
  },
);

export async function requireParticipant(): Promise<AuthedParticipant> {
  const me = await getCurrentParticipant();
  if (!me) throw new Error("Not signed in");
  return me;
}

/**
 * Organizer-gated actions. Caller must have picked a participant AND either
 * be flagged as organizer on their row OR be holding the admin password
 * cookie. Both conditions must be satisfied — no bare-password bypass.
 */
export async function requireOrganizer(): Promise<AuthedParticipant> {
  const me = await requireParticipant();
  if (!me.isAdmin && me.role !== "organizer") {
    throw new Error("Organizer only");
  }
  return me;
}

export async function requireJudge(): Promise<AuthedParticipant> {
  const me = await requireParticipant();
  if (!me.isAdmin && me.role !== "judge" && me.role !== "organizer") {
    throw new Error("Judge only");
  }
  return me;
}
