"use client";

import { Trophy } from "lucide-react";
import type { LeagueView } from "@/lib/football/views";

interface TopLeaguesProps {
  leagues: LeagueView[];
  selectedLeagueId: string | null;
  onSelectLeague: (leagueId: string | null) => void;
}

const MAJOR_SLUGS = [
  { slug: "premier-league", short: "EPL" },
  { slug: "la-liga", short: "LALIGA" },
  { slug: "bundesliga", short: "BUNDESLIGA" },
  { slug: "serie-a", short: "SERIE A" },
  { slug: "ligue-1", short: "LIGUE 1" },
];

export function TopLeagues({ leagues, selectedLeagueId, onSelectLeague }: TopLeaguesProps) {
  const items = MAJOR_SLUGS.map(({ slug, short }) => {
    const league = leagues.find((l) => l.name.toLowerCase().includes(slug.replace("-", " ")));
    return { id: league?.id ?? slug, name: league?.name ?? short, flag: league?.flag ?? "🏆", available: league?.available ?? false, short };
  });

  return (
    <section className="mm-section">
      <div className="mm-section-head">
        <h2 className="mm-section-title"><Trophy size={18} strokeWidth={2} /> Top Leagues</h2>
      </div>
      <div className="mm-league-scroll" role="tablist">
        {items.map((league) => (
          <button
            key={league.id}
            role="tab"
            aria-selected={selectedLeagueId === league.id}
            className={`mm-league-chip ${selectedLeagueId === league.id ? "active" : ""}`}
            onClick={() => onSelectLeague(selectedLeagueId === league.id ? null : league.available ? league.id : null)}
            title={league.available ? league.name : "Not available on current plan"}
          >
            <span className="mm-league-icon">{league.flag}</span>
            <span className="mm-league-name">{league.short}</span>
          </button>
        ))}
        <button className="mm-league-chip" onClick={() => onSelectLeague(null)}>
          <span className="mm-league-icon">•••</span>
          <span className="mm-league-name">More</span>
        </button>
      </div>
    </section>
  );
}
