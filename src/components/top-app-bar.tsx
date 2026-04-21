import Image from "next/image";
import Link from "next/link";
import { NavLink } from "./nav-link";
import { UserAvatar } from "./user-avatar";
import { signOut } from "@/auth";

type Role = "participant" | "organizer" | "judge";

const BASE_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/bracket", label: "Bracket" },
  { href: "/matchup", label: "Matchup" },
  { href: "/betting", label: "Betting" },
  { href: "/prizes", label: "Prizes" },
] as const;

function itemsForRole(role: Role) {
  const items = [...BASE_ITEMS] as { href: string; label: string }[];
  if (role === "judge" || role === "organizer") {
    items.push({ href: "/judge", label: "Judge" });
  }
  if (role === "organizer") {
    items.push({ href: "/admin", label: "Admin" });
  }
  return items;
}

type TopAppBarProps = {
  bankroll?: number;
  user?: {
    name: string;
    email: string;
    image: string | null;
  };
  role?: Role;
};

export function TopAppBar({ bankroll = 1000, user, role = "participant" }: TopAppBarProps) {
  const navItems = itemsForRole(role);
  return (
    <nav className="fixed top-0 w-full z-50 bg-[#121416]/80 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,208,180,0.05)]">
      <div className="flex justify-between items-center px-6 py-4 w-full max-w-7xl mx-auto">
        <Link href="/" aria-label="The Vibe-a-thon — home" className="flex items-center">
          <Image
            src="/header_logo.svg"
            alt="The Vibe-a-thon"
            width={174}
            height={32}
            priority
            unoptimized
            className="h-8 w-auto"
          />
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-6 font-headline text-sm font-bold tracking-tight uppercase">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="bg-surface-container-high px-4 py-2 rounded-full border border-outline-variant/20">
            <span className="text-primary-container font-headline font-bold">
              ₿ {bankroll.toLocaleString()}
            </span>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <UserAvatar src={user.image} name={user.name} email={user.email} />
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/signin" });
                }}
              >
                <button
                  type="submit"
                  aria-label="Sign out"
                  className="hidden md:inline-flex w-10 h-10 rounded-full border border-outline-variant/30 items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">
                    logout
                  </span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      <div className="bg-gradient-to-b from-primary-container/10 to-transparent h-[1px]" />
    </nav>
  );
}
