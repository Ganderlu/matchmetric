"use client";

import { BellRing } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { NotificationPreferences as NotificationPreferencesType } from "@/types/userProfile";
import { Toggle } from "./controls";

type ToggleKey = Exclude<keyof NotificationPreferencesType, "enabled">;

interface Row {
  key: ToggleKey;
  label: string;
  description: string;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Match notifications",
    rows: [
      { key: "matchStarting", label: "Match starting soon", description: "A reminder shortly before kick-off." },
      { key: "matchLive", label: "Match live", description: "When a fixture you follow gets under way." },
      { key: "matchFinished", label: "Full-time result", description: "The final score once a match ends." },
    ],
  },
  {
    title: "Prediction notifications",
    rows: [
      { key: "analysisCompleted", label: "Analysis completed", description: "When an analysis you requested is ready." },
      { key: "predictionUpdated", label: "Important prediction update", description: "When a live analysis changes materially." },
      { key: "predictionSettled", label: "Prediction settled", description: "When a recorded prediction is graded." },
      { key: "savedPredictionResult", label: "Saved prediction result", description: "The outcome of a prediction you saved." },
    ],
  },
  {
    title: "Account notifications",
    rows: [
      { key: "accountSecurity", label: "Security alerts", description: "Sign-ins and sensitive account activity." },
      { key: "accountChanges", label: "Account changes", description: "Changes to your profile or preferences." },
      { key: "platformAnnouncements", label: "Platform announcements", description: "Important MatchMetric news." },
    ],
  },
];

/** Master switch plus grouped individual notification toggles. */
export function NotificationSettings() {
  const { notifications, setNotifications } = useUserPreferences();

  if (!notifications) return null;
  const master = notifications.enabled;

  const update = (key: ToggleKey, value: boolean) =>
    setNotifications({ [key]: value } as Partial<NotificationPreferencesType>);

  return (
    <>
      <div className="switch-list">
        <div className="switch-row">
          <div className="switch-copy">
            <strong>Allow notifications</strong>
            <span>Master switch. Turning this off pauses every notification below.</span>
          </div>
          <Toggle
            checked={master}
            label="Allow notifications"
            onChange={(next) => setNotifications({ enabled: next })}
          />
        </div>
      </div>

      {GROUPS.map((group) => (
        <div className="settings-field-group" key={group.title} style={master ? undefined : { opacity: 0.5 }}>
          <div className="settings-field-label">
            <strong>{group.title}</strong>
          </div>
          <div className="switch-list">
            {group.rows.map((row) => (
              <div className="switch-row" key={row.key}>
                <div className="switch-copy">
                  <strong>{row.label}</strong>
                  <span>{row.description}</span>
                </div>
                <Toggle
                  checked={notifications[row.key]}
                  disabled={!master}
                  label={row.label}
                  onChange={(next) => update(row.key, next)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="profile-note">
        <BellRing size={13} />
        Your choices are saved to your account and will control delivery as notification channels
        are switched on. MatchMetric does not currently send push notifications.
      </div>
    </>
  );
}
