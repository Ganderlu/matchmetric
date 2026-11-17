"use client";

import { Check, Info, Sparkles } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { MembershipTier } from "@/types/userProfile";

const TIER_LABELS: Record<MembershipTier, string> = {
  free: "Free plan",
  plus: "MatchMetric Plus",
  pro: "MatchMetric Pro",
};

/** What every member can use today. */
const INCLUDED = [
  "Manual match analysis built on real fixture statistics",
  "Automatic picks across the competitions MatchMetric tracks",
  "Saved predictions, graded against the final result",
  "Up to 5 matches in a single manual analysis",
];

/** Current plan, what it includes, and an honest note on paid tiers. */
export function MembershipCard() {
  const { profile } = useUserProfile();
  if (!profile) return null;

  const tier = profile.membershipTier;

  return (
    <>
      <div className="profile-plan">
        <span className="profile-row-icon">
          <Sparkles size={16} strokeWidth={1.9} />
        </span>
        <span className="profile-plan-copy">
          <span className="profile-plan-name">{TIER_LABELS[tier]}</span>
          <span className="profile-plan-blurb">
            {tier === "free"
              ? "Everything MatchMetric offers today is available to you at no cost."
              : "This plan is active on your account."}
          </span>
        </span>
        <span className="profile-tier-chip">Active</span>
      </div>

      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Included in your plan</strong>
          <span>Features available to every MatchMetric member.</span>
        </div>
        <ul className="profile-feature-list">
          {INCLUDED.map((feature) => (
            <li key={feature}>
              <Check size={13} />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="profile-note">
        <Info size={13} />
        MatchMetric Plus and Pro are planned but are not available yet. There is no pricing to show
        and nothing to upgrade to today, so this page has no upgrade button.
      </div>
    </>
  );
}
