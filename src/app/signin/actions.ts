"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { PID_COOKIE } from "@/server/current-participant";
import { ADMIN_COOKIE, adminPassword } from "@/server/admin-auth";
import { run, type ActionResult } from "@/server/action-result";
import {
  buildMagicLinkUrl,
  createMagicLink,
  maskEmail,
  sendMagicLinkEmail,
} from "@/server/magic-link";

const ONE_DAY = 60 * 60 * 24;

export type MagicLinkSendPayload = {
  emailMasked: string;
  expiresAt: string;
  /**
   * Dev-only: the raw magic link, returned when `RESEND_API_KEY` is unset so
   * the signin UI can still complete without a real mailbox. Never set in
   * production — gated on `process.env.RESEND_API_KEY`.
   */
  devLink: string | null;
};

export async function sendMagicLinkAction(
  participantId: string,
  callbackUrl: string,
): Promise<ActionResult<MagicLinkSendPayload>> {
  return run(async () => {
    const [row] = await db
      .select({
        id: participants.id,
        name: participants.name,
        email: participants.email,
        role: participants.role,
      })
      .from(participants)
      .where(eq(participants.id, participantId))
      .limit(1);
    if (!row) throw new Error("That participant doesn't exist anymore.");

    // Organizers always land on /admin after clicking their magic link,
    // regardless of where the sign-in flow was entered from. Everyone
    // else gets whatever callback the picker carried in from `?callbackUrl=`.
    const targetCallback =
      row.role === "organizer" ? "/admin" : sanitizeCallbackUrl(callbackUrl);

    const { rawToken, expiresAt } = await createMagicLink({
      participantId: row.id,
      callbackUrl: targetCallback,
    });
    const url = buildMagicLinkUrl(rawToken);

    const delivered = await sendMagicLinkEmail({
      to: row.email,
      name: row.name,
      url,
      expiresAt,
      audience: row.role === "organizer" ? "organizer" : "traveller",
    });

    return {
      emailMasked: maskEmail(row.email),
      expiresAt: expiresAt.toISOString(),
      devLink: delivered ? null : url,
    };
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

/** Only allow same-origin path redirects to avoid open-redirect in the email. */
function sanitizeCallbackUrl(raw: string): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
