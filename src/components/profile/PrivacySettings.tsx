"use client";

import { Database, Download, Eye, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Notice, type NoticeMessage } from "./controls";
import { ProfileMenuItem } from "./ProfileMenuItem";

/**
 * Privacy controls. MatchMetric has no public profiles, so visibility is stated honestly
 * rather than offering a switch that would do nothing.
 */
export function PrivacySettings({ onRequestDelete }: { onRequestDelete: () => void }) {
  const { profile } = useUserProfile();
  const [message, setMessage] = useState<NoticeMessage | null>(null);

  const exportData = () => {
    if (!profile) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { uid: profile.uid, email: profile.email },
      profile,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "matchmetric-account-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: "success", text: "Your account data was downloaded as JSON." });
  };

  return (
    <>
      <ProfileMenuItem
        icon={Eye}
        title="Profile visibility"
        subtitle="MatchMetric has no public profiles. Your account details stay private to you."
        value="Private"
      />

      <ProfileMenuItem
        icon={Database}
        title="Data & privacy"
        subtitle="Your profile and preferences are stored privately under your account and are never shared."
        value="Owner-only"
      />

      <ProfileMenuItem
        icon={Download}
        title="Export your data"
        subtitle="Download a copy of your profile and preferences as a JSON file."
        onClick={exportData}
      />

      <ProfileMenuItem
        icon={ShieldAlert}
        title="Delete account & data"
        subtitle="Request permanent deletion of your account and everything stored with it."
        tone="danger"
        onClick={onRequestDelete}
      />

      <Notice message={message} />
    </>
  );
}
