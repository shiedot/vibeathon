import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentParticipant } from "@/server/current-participant";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/roster", label: "Roster" },
  { href: "/admin/pods", label: "Pods & R1" },
  { href: "/admin/play-in", label: "Play-in" },
  { href: "/admin/battles", label: "Battles" },
  { href: "/admin/betting", label: "Bet pools" },
  { href: "/admin/timing", label: "Timing" },
  { href: "/admin/bankroll", label: "Bankroll" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/overrides", label: "Overrides" },
  { href: "/admin/settlement", label: "Settlement" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentParticipant();
  if (!me) redirect("/signin");
  if (me.role !== "organizer") redirect("/");

  return (
    <div className="max-w-7xl mx-auto px-6 space-y-6">
      <nav className="flex gap-2 overflow-x-auto py-2 -mx-2 px-2 border-b border-outline-variant/20">
        {ADMIN_NAV.map((n) => (
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
