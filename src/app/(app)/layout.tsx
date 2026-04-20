import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TopAppBar } from "@/components/top-app-bar";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  // Best-effort read of the Traveller row linked to this user. It's fine if
  // none exists yet — the organizer ingests the roster separately.
  let bankroll = 1000;
  let traveller: { name: string; email: string; image: string | null } = {
    name: session.user.name ?? session.user.email ?? "Traveller",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  try {
    const row = await db
      .select({
        personalBankroll: participants.personalBankroll,
        name: participants.name,
      })
      .from(participants)
      .where(eq(participants.userId, session.user.id))
      .limit(1);
    if (row[0]) {
      bankroll = row[0].personalBankroll;
      traveller = { ...traveller, name: row[0].name };
    }
  } catch {
    // DB not migrated yet; fall through with the defaults.
  }

  return (
    <>
      <TopAppBar bankroll={bankroll} user={traveller} />
      <div className="pt-24 pb-32">{children}</div>
      <BottomNavBar />
    </>
  );
}
