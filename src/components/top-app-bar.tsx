import Link from "next/link";
import Image from "next/image";
import { NavLink } from "./nav-link";
import { signOut } from "@/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/bracket", label: "Bracket" },
  { href: "/matchup", label: "Matchup" },
  { href: "/betting", label: "Betting" },
  { href: "/prizes", label: "Prizes" },
] as const;

type TopAppBarProps = {
  bankroll?: number;
  user?: {
    name: string;
    email: string;
    image: string | null;
  };
};

export function TopAppBar({ bankroll = 1000, user }: TopAppBarProps) {
  const initials = (user?.name ?? "T")
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#121416]/80 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,208,180,0.05)]">
      <div className="flex justify-between items-center px-6 py-4 w-full max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary/40 flex items-center justify-center bg-surface-container-highest">
            <span className="material-symbols-outlined filled text-primary text-lg">
              rocket_launch
            </span>
          </div>
          <span className="text-xl font-black text-primary-container tracking-tighter font-headline uppercase">
            The Vibe-a-thon
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-8 font-headline text-sm font-bold tracking-tight uppercase">
            {NAV_ITEMS.map((item) => (
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
              <div
                className="w-10 h-10 rounded-full border-2 border-primary/40 overflow-hidden bg-surface-container-highest flex items-center justify-center text-xs font-headline font-bold text-primary"
                title={user.email}
              >
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  initials
                )}
              </div>
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
