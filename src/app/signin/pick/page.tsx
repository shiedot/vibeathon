import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { getCurrentParticipant } from "@/server/current-participant";
import { ParticipantPicker } from "../picker";

export const dynamic = "force-dynamic";

type PickPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function PickPage({ searchParams }: PickPageProps) {
  const me = await getCurrentParticipant();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  if (me) redirect(callbackUrl);

  const rows = await db
    .select({
      id: participants.id,
      name: participants.name,
      department: participants.department,
      employeeId: participants.employeeId,
      role: participants.role,
    })
    .from(participants)
    .orderBy(asc(participants.name));

  return <ParticipantPicker participants={rows} callbackUrl={callbackUrl} />;
}
