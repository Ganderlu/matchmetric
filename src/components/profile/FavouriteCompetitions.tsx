"use client";

import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { trackedCompetitions } from "@/lib/football/leagues";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { MAX_FAVOURITE_COMPETITIONS } from "@/types/userProfile";

/** Pick and order the tracked competitions the member follows. */
export function FavouriteCompetitions() {
  const { favouriteCompetitions, setFavouriteCompetitions } = useUserPreferences();

  const toggle = (slug: string) => {
    if (favouriteCompetitions.includes(slug)) {
      setFavouriteCompetitions(favouriteCompetitions.filter((item) => item !== slug));
      return;
    }
    if (favouriteCompetitions.length >= MAX_FAVOURITE_COMPETITIONS) return;
    setFavouriteCompetitions([...favouriteCompetitions, slug]);
  };

  const move = (slug: string, direction: -1 | 1) => {
    const index = favouriteCompetitions.indexOf(slug);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= favouriteCompetitions.length) return;
    const next = [...favouriteCompetitions];
    [next[index], next[target]] = [next[target], next[index]];
    setFavouriteCompetitions(next);
  };

  const nameFor = (slug: string) =>
    trackedCompetitions.find((competition) => competition.slug === slug)?.name ?? slug;

  return (
    <div className="settings-field-group">
      <div className="settings-field-label">
        <strong>Favourite leagues</strong>
        <span>Browse the competitions MatchMetric tracks and order the ones you care about first.</span>
      </div>

      {favouriteCompetitions.length ? (
        <ol className="profile-pill-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {favouriteCompetitions.map((slug, index) => (
            <li className="profile-pill" key={slug}>
              <span style={{ marginRight: 4, color: "#7e8da0" }}>{index + 1}.</span>
              {nameFor(slug)}
              <button
                type="button"
                aria-label={`Move ${nameFor(slug)} up`}
                onClick={() => move(slug, -1)}
                disabled={index === 0}
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                aria-label={`Move ${nameFor(slug)} down`}
                onClick={() => move(slug, 1)}
                disabled={index === favouriteCompetitions.length - 1}
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                aria-label={`Remove ${nameFor(slug)}`}
                onClick={() => toggle(slug)}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="profile-empty">No favourite leagues selected yet.</p>
      )}

      <div className="chip-row">
        {trackedCompetitions.map((competition) => {
          const selected = favouriteCompetitions.includes(competition.slug);
          return (
            <button
              key={competition.slug}
              type="button"
              className={`chip-toggle ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              onClick={() => toggle(competition.slug)}
            >
              {selected ? <Check size={12} /> : null}
              {competition.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
