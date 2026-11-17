"use client";

import { Search, X } from "lucide-react";
import { OPEN_GAMES_SORTS } from "@/lib/open-games/types";
import type { OpenGamesCounts, OpenGamesSortKey, OpenGamesStatusFilter } from "@/lib/open-games/types";

/**
 * The Open Games filters.
 *
 * Status and sort are view concerns handled locally so switching them is instant; only the search
 * text is sent to the server, which owns which entries come back. The counts come from the same
 * payload the list is drawn from, so a chip never claims more entries than are on the page.
 */

const STATUSES: { key: OpenGamesStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "live", label: "Live" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "voided", label: "Voided" },
];

export function OpenGamesControls({
  status,
  onStatus,
  sort,
  onSort,
  search,
  onSearch,
  counts,
}: {
  status: OpenGamesStatusFilter;
  onStatus: (status: OpenGamesStatusFilter) => void;
  sort: OpenGamesSortKey;
  onSort: (sort: OpenGamesSortKey) => void;
  search: string;
  onSearch: (search: string) => void;
  counts: OpenGamesCounts;
}) {
  return (
    <div className="og-controls">
      <div className="og-status" role="group" aria-label="Filter by status">
        {STATUSES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={status === key}
            className={`og-chip ${status === key ? "active" : ""}`}
            onClick={() => onStatus(key)}
          >
            <span>{label}</span>
            <em>{counts[key]}</em>
          </button>
        ))}
      </div>

      <div className="og-tools">
        <label className="og-search">
          <span className="og-search-icon" aria-hidden="true">
            <Search size={14} />
          </span>
          <input
            type="search"
            value={search}
            placeholder="Search reference, team, competition"
            aria-label="Search your open games"
            onChange={(event) => onSearch(event.target.value)}
          />
          {search ? (
            <button type="button" className="og-search-clear" aria-label="Clear search" onClick={() => onSearch("")}>
              <X size={13} />
            </button>
          ) : null}
        </label>

        <label className="og-sort">
          <span>Sort</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as OpenGamesSortKey)}>
            {OPEN_GAMES_SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
