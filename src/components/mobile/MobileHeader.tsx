"use client";

import { Bell, TrendingUp, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const DESKTOP_LINKS = [
  { href: "/", label: "Football" },
  { href: "/manual-analysis", label: "Manual Analysis" },
  { href: "/open-games", label: "Open Games" },
  { href: "/history", label: "History" },
  { href: "/insights", label: "Insights" },
];

function getInitials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function MobileHeader() {
  const { user } = useAuth();
  const pathname = usePathname();
  return (
    <header className="mm-header">
      <div className="mm-header-brand">
        <span className="mm-header-logo"><TrendingUp size={22} strokeWidth={2.2} /></span>
        <div>
          <h1 className="mm-header-title">MatchMetric</h1>
          <p className="mm-header-tagline">Predict Smarter. Win Bigger.</p>
        </div>
      </div>
      <nav className="mm-desktop-nav" aria-label="Main navigation">
        {DESKTOP_LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`mm-desktop-nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mm-header-actions">
        <button className="mm-icon-button" aria-label="Notifications">
          <Bell size={20} strokeWidth={1.8} />
          <span className="mm-notification-dot" aria-hidden="true" />
        </button>
        <Link
          href={user ? "/profile" : "/login"}
          className="mm-avatar"
          aria-label={user ? "Open profile" : "Sign in"}
        >
          {user ? getInitials(user.displayName || user.email) : <UserRound size={18} strokeWidth={1.8} />}
        </Link>
      </div>
    </header>
  );
}
