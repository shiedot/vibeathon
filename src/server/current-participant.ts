import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { participants, type Participant } from "@/db/schema";

export type AuthedParticipant = {
  participant: Participant;
  userId: string;
  role: "participant" | "organizer" | "judge";
};

export const getCurrentParticipant = cache(
  async (): Promise<AuthedParticipant | null> => {
    const session = await auth();
    if (!session?.user?.id) return null;

    const rows = await db
      .select()
      .from(participants)
      .where(eq(participants.userId, session.user.id))
      .limit(1);
    if (rows.length === 0) return null;

    return {
      participant: rows[0],
      userId: session.user.id,
      role: rows[0].role,
    };
  },
);

export async function requireParticipant(): Promise<AuthedParticipant> {
  const me = await getCurrentParticipant();
  if (!me) throw new Error("Not authenticated or not on roster");
  return me;
}

export async function requireOrganizer(): Promise<AuthedParticipant> {
  const me = await requireParticipant();
  if (me.role !== "organizer") {
    throw new Error("Organizer only");
  }
  return me;
}

export async function requireJudge(): Promise<AuthedParticipant> {
  const me = await requireParticipant();
  if (me.role !== "judge" && me.role !== "organizer") {
    throw new Error("Judge only");
  }
  return me;
}
