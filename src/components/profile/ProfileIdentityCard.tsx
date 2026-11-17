"use client";

import { BadgeCheck, Pencil } from "lucide-react";
import type { UserProfile } from "@/types/userProfile";
import { initials } from "./controls";

const TIER_LABELS: Record<UserProfile["membershipTier"], string> = {
  free: "Free plan",
  plus: "MatchMetric Plus",
  pro: "MatchMetric Pro",
};

/** Prominent identity block: avatar, name, username, email and membership. */
export function ProfileIdentityCard({
  profile,
  onEdit,
}: {
  profile: UserProfile;
  onEdit: () => void;
}) {
  const name = profile.displayName || "MatchMetric member";

  return (
    <section className="profile-identity-card">
      <span
        className="profile-identity-avatar"
        style={
          profile.photoURL
            ? {
                backgroundImage: `url("${profile.photoURL}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "transparent",
              }
            : undefined
        }
        aria-hidden={profile.photoURL ? "true" : undefined}
      >
        {profile.photoURL ? "" : initials(name)}
      </span>

      <div className="profile-identity-info">
        <span className="profile-identity-name">{name}</span>
        {profile.username ? (
          <span className="profile-identity-username">@{profile.username}</span>
        ) : null}
        <span className="profile-identity-email">{profile.email}</span>
        <div className="profile-identity-chips">
          <span className="profile-tier-chip">{TIER_LABELS[profile.membershipTier]}</span>
          <span className="profile-tier-chip muted">
            <BadgeCheck size={12} /> Verified account
          </span>
        </div>
      </div>

      <button type="button" className="outline-button profile-identity-edit" onClick={onEdit}>
        <Pencil size={13} /> Edit profile
      </button>
    </section>
  );
}
