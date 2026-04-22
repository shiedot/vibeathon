/**
 * Shared-password gate for the /admin console.
 *
 * Deliberately dumb: the password is either `ADMIN_PASSWORD` from env or a
 * hardcoded literal. On success we set a signed-enough cookie `vibeathon.admin`
 * whose value is just the password itself — this isn't protecting money,
 * it's preventing casual participants from wandering into /admin.
 */
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "vibeathon.admin";
export const DEFAULT_ADMIN_PASSWORD = "V1B3";

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const val = store.get(ADMIN_COOKIE)?.value;
  return Boolean(val) && val === adminPassword();
}
