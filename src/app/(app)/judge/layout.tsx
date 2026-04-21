import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentParticipant } from "@/server/current-participant";

const JUDGE_NAV = [
  { href: "/judge", label: "Overview" },
  { href: "/judge/deadlocks", label: "Deadlocks" },
  { href: "/judge/vote", label: "SF / Final vote" },
  { href: "/judge/coaches", label: "Coach nominations" },
];

export default async function JudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentParticipant();
  if (!me) redirect("/signin");
  if (!me.isAdmin && me.role !== "judge" && me.role !== "organizer") {
    redirect("/");
  }
  return (
    <div className="max-w-7xl mx-auto px-6 space-y-6">
      <nav className="flex gap-2 overflow-x-auto py-2 border-b border-outline-variant/20">
        {JUDGE_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="whitespace-nowrap px-3 py-2 rounded-lg text-xs uppercase tracking-widest font-bold text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
