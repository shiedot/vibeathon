"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

type Role = "participant" | "organizer" | "judge";

const BASE_NAV = [
  { href: "/", label: "Home", icon: "dashboard" },
  { href: "/bracket", label: "Bracket", icon: "account_tree" },
  { href: "/matchup", label: "Matchup", icon: "stadium" },
  { href: "/betting", label: "Betting", icon: "monetization_on" },
  { href: "/prizes", label: "Prizes", icon: "emoji_events" },
] as const;

export function BottomNavBar({ role = "participant" }: { role?: Role }) {
  const pathname = usePathname();
  const nav = [...BASE_NAV] as { href: string; label: string; icon: string }[];
  if (role === "organizer") {
    nav.push({ href: "/admin", label: "Admin", icon: "tune" });
  } else if (role === "judge") {
    nav.push({ href: "/judge", label: "Judge", icon: "gavel" });
  }

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#121416]/90 backdrop-blur-2xl border-t border-primary-container/15 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:hidden">
      <div className="flex justify-around items-center pt-3 pb-6 px-4">
        {nav.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center active:scale-90 transition-transform duration-150",
                isActive
                  ? "text-primary-container drop-shadow-[0_0_8px_rgba(0,208,180,0.6)]"
                  : "text-gray-500 hover:text-primary-container/80",
              )}
            >
              <span
                className={clsx(
                  "material-symbols-outlined",
                  isActive && "filled",
                )}
              >
                {item.icon}
              </span>
              <span className="font-body text-[10px] uppercase tracking-[0.05em] font-bold mt-1">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
