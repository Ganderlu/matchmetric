"use client";

import { Info } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { DashboardFilter } from "@/types/userProfile";
import { Toggle } from "./controls";
import { FavouriteTeams } from "./FavouriteTeams";
import { FavouriteCompetitions } from "./FavouriteCompetitions";

const FILTERS: { value: DashboardFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
];

/** Favourite teams, favourite leagues and the home dashboard defaults. */
export function FootballPreferences() {
  const { dashboard, setDashboard } = useUserPreferences();
  if (!dashboard) return null;

  return (
    <>
      <FavouriteTeams />
      <FavouriteCompetitions />

      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Home dashboard</strong>
          <span>How your fixtures are arranged when you open MatchMetric.</span>
        </div>

        <div className="segmented">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segment ${dashboard.defaultFilter === option.value ? "active" : ""}`}
              onClick={() => setDashboard({ defaultFilter: option.value })}
            >
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>

        <div className="switch-list">
          <div className="switch-row">
            <div className="switch-copy">
              <strong>Highlight favourite teams</strong>
              <span>Mark fixtures that involve a team you follow.</span>
            </div>
            <Toggle
              checked={dashboard.highlightFavouriteTeams}
              label="Highlight favourite teams"
              onChange={(next) => setDashboard({ highlightFavouriteTeams: next })}
            />
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>Show live matches first</strong>
              <span>Put in-play fixtures above upcoming ones.</span>
            </div>
            <Toggle
              checked={dashboard.liveFirst}
              label="Show live matches first"
              onChange={(next) => setDashboard({ liveFirst: next })}
            />
          </div>
        </div>
      </div>

      <div className="profile-note">
        <Info size={13} />
        These preferences are saved to your account. They shape your dashboard and are never used
        as evidence when the prediction engine rates a match.
      </div>
    </>
  );
}
