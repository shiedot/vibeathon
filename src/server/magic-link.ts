/**
 * Magic-link login primitives.
 *
 * Flow:
 *   1. User picks their name.
 *   2. `createMagicLink` generates a 32-byte random token, stores a SHA-256
 *      hash in `magic_links`, returns the raw token (only visible once).
 *   3. `sendMagicLink` mails the clickable URL to the participant's email.
 *   4. `consumeMagicLink` validates + marks `used_at` in a single transaction.
 *
 * The raw token never touches the DB; only the hash is persisted so a leaked
 * DB dump can't be replayed as valid login links.
 */
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db/client";
import { magicLinks, participants, type Participant } from "@/db/schema";

const TOKEN_BYTES = 32;
const LINK_TTL_MS = 15 * 60 * 1000;

export type MagicLinkSendResult = {
  email: string;
  expiresAt: Date;
  delivered: boolean;
};

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createMagicLink(params: {
  participantId: string;
  callbackUrl: string;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);

  await db.insert(magicLinks).values({
    tokenHash,
    participantId: params.participantId,
    callbackUrl: params.callbackUrl || "/",
    expiresAt,
  });

  return { rawToken, expiresAt };
}

export async function consumeMagicLink(
  rawToken: string,
): Promise<{ participant: Participant; callbackUrl: string } | null> {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);

  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(magicLinks)
      .where(
        and(
          eq(magicLinks.tokenHash, tokenHash),
          isNull(magicLinks.usedAt),
          gt(magicLinks.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const link = rows[0];
    if (!link) return null;

    // Constant-time double-check (the unique lookup above is already exact,
    // but this protects against a future index change exposing early-exit).
    const a = Buffer.from(link.tokenHash);
    const b = Buffer.from(tokenHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    await tx
      .update(magicLinks)
      .set({ usedAt: new Date() })
      .where(eq(magicLinks.id, link.id));

    const pRows = await tx
      .select()
      .from(participants)
      .where(eq(participants.id, link.participantId))
      .limit(1);
    const participant = pRows[0];
    if (!participant) return null;

    return { participant, callbackUrl: link.callbackUrl || "/" };
  });
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 3))}${local.slice(-1)}@${domain}`;
}

/**
 * Best-effort origin derivation. Prefers `AUTH_URL`, then `NEXT_PUBLIC_APP_URL`,
 * and finally falls back to localhost. We intentionally don't pull from headers
 * here — server actions shouldn't depend on the inbound request's Host.
 */
function resolveOrigin(): string {
  const candidate =
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
    return candidate.replace(/\/+$/, "");
  }
  return `https://${candidate.replace(/\/+$/, "")}`;
}

export function buildMagicLinkUrl(rawToken: string): string {
  const origin = resolveOrigin();
  return `${origin}/signin/verify?token=${encodeURIComponent(rawToken)}`;
}

export async function sendMagicLinkEmail(params: {
  to: string;
  name: string;
  url: string;
  expiresAt: Date;
  /** Controls subject/heading/CTA copy. Defaults to traveller-facing text. */
  audience?: "traveller" | "organizer";
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Vibe-a-thon <onboarding@resend.dev>";

  const minutes = Math.max(
    1,
    Math.round((params.expiresAt.getTime() - Date.now()) / 60000),
  );

  const isOrganizer = params.audience === "organizer";
  const subject = isOrganizer
    ? "Your Vibe-a-thon admin sign-in link"
    : "Your Vibe-a-thon sign-in link";
  const heading = isOrganizer
    ? "Sign in to the Vibe-a-thon admin console"
    : "Sign in to the Vibe-a-thon";
  const cta = isOrganizer ? "Open admin console" : "Enter the Vibe-a-thon";
  const intro = isOrganizer
    ? `Click the link below to open the Vibe-a-thon admin console. You'll still need the shared admin password once you land.`
    : `Click the link below to sign in to the Vibe-a-thon:`;

  const text = [
    `Hey ${params.name},`,
    ``,
    intro,
    params.url,
    ``,
    `This link expires in ${minutes} minutes and can only be used once.`,
    `If you didn't request it, you can ignore this email.`,
  ].join("\n");

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px">Hey ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 20px">${escapeHtml(intro)}</p>
      <p style="margin:0 0 24px">
        <a href="${params.url}"
           style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">
          ${escapeHtml(cta)}
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#555">
        Or paste this URL into your browser:
      </p>
      <p style="margin:0 0 20px;font-size:13px;word-break:break-all">
        <a href="${params.url}" style="color:#0a7">${params.url}</a>
      </p>
      <p style="margin:0;font-size:12px;color:#888">
        Expires in ${minutes} minutes · single use · ignore if you didn't request this.
      </p>
    </div>
  `;

  if (!apiKey) {
    console.warn(
      `[magic-link] RESEND_API_KEY not set — would have emailed ${params.to}. Link: ${params.url}`,
    );
    return false;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error("[magic-link] resend error", error);
    throw new Error("Couldn't send the sign-in email. Try again in a moment.");
  }

  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
