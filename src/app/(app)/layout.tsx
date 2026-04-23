import { redirect } from "next/navigation";
import { TopAppBar } from "@/components/top-app-bar";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { WinCelebration } from "@/components/win-celebration";
import { getCurrentParticipant } from "@/server/current-participant";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentParticipant();
  if (!me) redirect("/signin");

  const traveller = {
    name: me.participant.name,
    email: me.participant.email,
    image: null,
  };

  return (
    <>
      <TopAppBar
        bankroll={
          me.role === "organizer" ? undefined : me.participant.personalBankroll
        }
        user={traveller}
        role={me.role}
        isAdmin={me.isAdmin}
      />
      <div className="pt-24 pb-32">{children}</div>
      <BottomNavBar role={me.role} />
      <WinCelebration />
    </>
  );
}
