"use client";

import { Info } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { AppearancePreferences } from "@/types/userProfile";

const THEMES: { value: AppearancePreferences["theme"]; label: string; hint: string }[] = [
  { value: "dark", label: "Dark", hint: "Applied today" },
  { value: "light", label: "Light", hint: "Not released" },
  { value: "system", label: "System", hint: "Not released" },
];

const ODDS_FORMATS: { value: AppearancePreferences["oddsFormat"]; label: string; hint: string }[] = [
  { value: "decimal", label: "Decimal", hint: "1.75" },
  { value: "american", label: "American", hint: "-134" },
  { value: "fractional", label: "Fractional", hint: "3/4" },
];

/** Theme and odds display. Saved to the account; dark and decimal are what run today. */
export function AppearanceSettings() {
  const { appearance, setAppearance } = useUserPreferences();
  if (!appearance) return null;

  return (
    <>
      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Theme</strong>
          <span>How MatchMetric looks.</span>
        </div>
        <div className="segmented">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segment ${appearance.theme === option.value ? "active" : ""}`}
              onClick={() => setAppearance({ theme: option.value })}
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Odds format</strong>
          <span>How bookmaker prices are written.</span>
        </div>
        <div className="segmented">
          {ODDS_FORMATS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segment ${appearance.oddsFormat === option.value ? "active" : ""}`}
              onClick={() => setAppearance({ oddsFormat: option.value })}
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="profile-note">
        <Info size={13} />
        Your choice is saved to your account. MatchMetric renders in dark and writes decimal odds
        today, so a different choice here is stored but not applied until those formats ship.
      </div>
    </>
  );
}
