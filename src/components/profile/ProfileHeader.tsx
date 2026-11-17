"use client";

import { Bell, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

/** Page-level header: title, a settings shortcut and a notifications shortcut. */
export function ProfileHeader({ onNotifications }: { onNotifications: () => void }) {
  return (
    <header className="profile-head">
      <div className="profile-head-copy">
        <p className="profile-eyebrow">Account</p>
        <h1>Profile</h1>
        <p>Manage your account, football preferences and how MatchMetric works for you.</p>
      </div>
      <div className="profile-head-actions">
        <button
          type="button"
          className="profile-icon-button"
          aria-label="Go to notification settings"
          onClick={onNotifications}
        >
          <Bell size={19} strokeWidth={1.9} />
        </button>
        <Link className="profile-icon-button" href="/settings" aria-label="Open advanced settings">
          <SettingsIcon size={19} strokeWidth={1.9} />
        </Link>
      </div>
    </header>
  );
}
