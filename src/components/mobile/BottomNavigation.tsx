"use client";

import { BarChart3, Clock, House, Layers, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/open-games", label: "Open Games", icon: Layers },
  { href: "/history", label: "History", icon: Clock },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="mm-bottom-nav" role="navigation" aria-label="Primary">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link key={href} href={href} className={`mm-nav-item ${isActive ? "active" : ""}`}>
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
