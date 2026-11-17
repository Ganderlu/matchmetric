"use client";

import { Info, Plus, X } from "lucide-react";
import { useState } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { MAX_FAVOURITE_TEAMS, cleanTeamName } from "@/types/userProfile";

/**
 * Favourite teams, stored by name.
 *
 * MatchMetric has no standalone team catalogue yet, so a team is added by name rather
 * than picked from a fake list. The chosen names drive the dashboard highlight.
 */
export function FavouriteTeams() {
  const { favouriteTeams, setFavouriteTeams } = useUserPreferences();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const cleaned = cleanTeamName(draft);
    if (!cleaned) {
      setError("Enter a team name of at least two characters.");
      return;
    }
    if (favouriteTeams.some((team) => team.toLowerCase() === cleaned.toLowerCase())) {
      setError("That team is already in your favourites.");
      return;
    }
    if (favouriteTeams.length >= MAX_FAVOURITE_TEAMS) {
      setError(`You can keep up to ${MAX_FAVOURITE_TEAMS} favourite teams.`);
      return;
    }
    setError(null);
    setDraft("");
    setFavouriteTeams([...favouriteTeams, cleaned]);
  };

  const remove = (team: string) => {
    setError(null);
    setFavouriteTeams(favouriteTeams.filter((item) => item !== team));
  };

  return (
    <div className="settings-field-group">
      <div className="settings-field-label">
        <strong>Favourite teams</strong>
        <span>Teams you follow, so fixtures involving them can be highlighted on your dashboard.</span>
      </div>

      {favouriteTeams.length ? (
        <div className="profile-pill-list">
          {favouriteTeams.map((team) => (
            <span className="profile-pill" key={team}>
              {team}
              <button type="button" aria-label={`Remove ${team}`} onClick={() => remove(team)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="profile-empty">No favourite teams yet.</p>
      )}

      <div className="profile-add-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add a team by name"
          aria-label="Add a favourite team"
        />
        <button type="button" className="outline-button" onClick={add} disabled={favouriteTeams.length >= MAX_FAVOURITE_TEAMS}>
          <Plus size={13} /> Add
        </button>
      </div>

      {error ? <p className="field-help" style={{ color: "#ff9eaa" }}>{error}</p> : null}

      <div className="profile-note">
        <Info size={13} />
        Team search across the provider catalogue is not available yet, so favourites are saved by
        name and kept with your account.
      </div>
    </div>
  );
}
