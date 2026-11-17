"use client";

import { Bell } from "lucide-react";

/** Page-level header: title and a notifications shortcut. */
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
      </div>
    </header>
  );
}
