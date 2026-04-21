import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { coachNominations, participants } from "@/db/schema";

export const MAX_NOMINATIONS = 3;

export async function nominateCoach(opts: {
  nominatorId: string;
  nomineeId: string;
  reason: string;
}) {
  if (opts.nominatorId === opts.nomineeId) {
    throw new Error("You can't nominate yourself");
  }
  const reason = opts.reason.trim();
  if (reason.length < 5) {
    throw new Error("Please give a one-sentence reason");
  }
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ c: count() })
      .from(coachNominations)
      .where(eq(coachNominations.nominatorId, opts.nominatorId));
    const used = Number(existing[0]?.c ?? 0);
    if (used >= MAX_NOMINATIONS) {
      throw new Error(`You've used all ${MAX_NOMINATIONS} nominations.`);
    }
    const dup = await tx
      .select({ id: coachNominations.id })
      .from(coachNominations)
      .where(
        and(
          eq(coachNominations.nominatorId, opts.nominatorId),
          eq(coachNominations.nomineeId, opts.nomineeId),
        ),
      );
    if (dup.length > 0) {
      throw new Error("You've already nominated this Traveller.");
    }
    await tx.insert(coachNominations).values({
      nominatorId: opts.nominatorId,
      nomineeId: opts.nomineeId,
      reason,
    });
  });
}

export async function listMyNominations(nominatorId: string) {
  return await db
    .select({
      id: coachNominations.id,
      nomineeId: coachNominations.nomineeId,
      reason: coachNominations.reason,
      submittedAt: coachNominations.submittedAt,
    })
    .from(coachNominations)
    .where(eq(coachNominations.nominatorId, nominatorId))
    .orderBy(desc(coachNominations.submittedAt));
}

export type CoachSummary = {
  nomineeId: string;
  name: string;
  count: number;
  reasons: string[];
};

export async function aggregateForJudges(): Promise<CoachSummary[]> {
  const rows = await db
    .select({
      nomineeId: coachNominations.nomineeId,
      reason: coachNominations.reason,
      name: participants.name,
    })
    .from(coachNominations)
    .innerJoin(
      participants,
      eq(participants.id, coachNominations.nomineeId),
    );
  const byNominee = new Map<string, CoachSummary>();
  for (const r of rows) {
    const existing = byNominee.get(r.nomineeId) ?? {
      nomineeId: r.nomineeId,
      name: r.name,
      count: 0,
      reasons: [],
    };
    existing.count += 1;
    existing.reasons.push(r.reason);
    byNominee.set(r.nomineeId, existing);
  }
  return Array.from(byNominee.values()).sort((a, b) => b.count - a.count);
}

export async function searchParticipants(query: string) {
  const q = `%${query.trim().toLowerCase()}%`;
  return await db
    .select({
      id: participants.id,
      name: participants.name,
      department: participants.department,
    })
    .from(participants)
    .where(
      and(
        eq(participants.role, "participant"),
        sql`(lower(${participants.name}) LIKE ${q} OR lower(${participants.email}) LIKE ${q})`,
      ),
    )
    .limit(12);
}
