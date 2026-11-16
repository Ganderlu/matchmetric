"use client";

import { ChevronDown, CircleDot, Search } from "lucide-react";

interface SportLeagueFiltersProps {
  leagues: { id: string; name: string; available: boolean }[];
  selectedLeagueId: string | null;
  onLeagueChange: (leagueId: string | null) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function SportLeagueFilters({
  leagues,
  selectedLeagueId,
  onLeagueChange,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
}: SportLeagueFiltersProps) {
  return (
    <div className="mm-filters">
      {searchOpen ? (
        <label className="mm-search-input">
          <Search size={16} strokeWidth={1.8} />
          <input
            type="text"
            aria-label="Search fixtures"
            placeholder="Search teams or leagues"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            autoFocus
          />
        </label>
      ) : (
        <>
          <button className="mm-pill mm-pill-active">
            <CircleDot size={16} strokeWidth={1.8} />
            <span>Football</span>
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>
          <div className="mm-league-select">
            <button className="mm-pill" onClick={() => onLeagueChange(null)}>
              <span>{leagues.find((l) => l.id === selectedLeagueId)?.name ?? "All Leagues"}</span>
              <ChevronDown size={14} strokeWidth={1.8} />
            </button>
            {selectedLeagueId && (
              <ul className="mm-league-dropdown" role="listbox">
                <li>
                  <button role="option" aria-selected={selectedLeagueId === null} onClick={() => onLeagueChange(null)}>All Leagues</button>
                </li>
                {leagues.map((league) => (
                  <li key={league.id}>
                    <button role="option" aria-selected={selectedLeagueId === league.id} onClick={() => onLeagueChange(league.id)}>{league.name}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="mm-icon-circle" onClick={onToggleSearch} aria-label="Search">
            <Search size={18} strokeWidth={1.8} />
          </button>
        </>
      )}
    </div>
  );
}
