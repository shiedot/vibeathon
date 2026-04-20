"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export function NavLink({
  href,
  children,
  className,
  activeClassName = "text-primary-container",
  inactiveClassName = "text-gray-400 hover:opacity-80 transition-opacity",
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={clsx(className, isActive ? activeClassName : inactiveClassName)}
    >
      {children}
    </Link>
  );
}
