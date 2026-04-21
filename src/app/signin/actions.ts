"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { PID_COOKIE } from "@/server/current-participant";
import { ADMIN_COOKIE, adminPassword } from "@/server/admin-auth";
import { run, type ActionResult } from "@/server/action-result";

const ONE_DAY = 60 * 60 * 24;

export async function enterAsParticipantAction(
  participantId: string,
): Promise<ActionResult<{ name: string }>> {
  return run(async () => {
    const [row] = await db
      .select({ id: participants.id, name: participants.name })
      .from(participants)
      .where(eq(participants.id, participantId))
      .limit(1);
    if (!row) throw new Error("That participant doesn't exist anymore.");

    const store = await cookies();
    store.set(PID_COOKIE, row.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_DAY * 30,
    });
    return { name: row.name };
  });
}

export async function leaveAction(): Promise<void> {
  const store = await cookies();
  store.delete(PID_COOKIE);
  store.delete(ADMIN_COOKIE);
  redirect("/signin");
}

export async function enterAdminAction(
  password: string,
): Promise<ActionResult<void>> {
  return run(async () => {
    if (password !== adminPassword()) {
      throw new Error("Wrong password.");
    }
    const store = await cookies();
    store.set(ADMIN_COOKIE, password, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_DAY,
    });
  });
}

export async function exitAdminAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/");
}
