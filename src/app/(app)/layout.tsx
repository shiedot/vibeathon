import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TopAppBar } from "@/components/top-app-bar";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { getCurrentParticipant } from "@/server/current-participant";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const me = await getCurrentParticipant();
  if (!me) redirect("/not-on-roster");

  const traveller = {
    name: me.participant.name,
    email: me.participant.email,
    image: session.user.image ?? null,
  };

  return (
    <>
      <TopAppBar
        bankroll={me.participant.personalBankroll}
        user={traveller}
        role={me.role}
      />
      <div className="pt-24 pb-32">{children}</div>
      <BottomNavBar role={me.role} />
    </>
  );
}
