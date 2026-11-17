"use client";

import { CalendarRange, Search, X } from "lucide-react";
import { HISTORY_RANGES, HISTORY_SORTS } from "@/lib/history/types";
import type { HistorySortKey, HistoryStatusCounts, HistoryStatusFilter } from "@/lib/history/types";
import type { HistoryQuery } from "@/hooks/use-history";

/**
 * The History filters.
 *
 * Status and sort are view concerns handled locally so switching them is instant; the date range
 * and the search text are sent to the server, which owns what counts as a completed record.
 */

const STATUSES: { key: HistoryStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "voided", label: "Voided" },
];

export function HistoryControls({
  status,
  onStatus,
  sort,
  onSort,
  query,
  onChange,
  counts,
}: {
  status: HistoryStatusFilter;
  onStatus: (status: HistoryStatusFilter) => void;
  sort: HistorySortKey;
  onSort: (sort: HistorySortKey) => void;
  query: HistoryQuery;
  onChange: (next: HistoryQuery) => void;
  counts: HistoryStatusCounts;
}) {
  const patch = (partial: Partial<HistoryQuery>) => onChange({ ...query, ...partial });

  return (
    <div className="history-controls">
      <div className="history-status" role="group" aria-label="Filter by result">
        {STATUSES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={status === key}
            className={`history-chip ${status === key ? "active" : ""}`}
            onClick={() => onStatus(key)}
          >
            <span>{label}</span>
            <em>{counts[key]}</em>
          </button>
        ))}
      </div>

      <div className="history-range" role="group" aria-label="Filter by date">
        <span className="history-range-icon" aria-hidden="true">
          <CalendarRange size={14} />
        </span>
        <div className="history-range-chips">
          {HISTORY_RANGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={query.range === key}
              className={`history-chip ${query.range === key ? "active" : ""}`}
              onClick={() => patch({ range: key })}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {query.range === "custom" ? (
        <div className="history-custom-range">
          <label>
            From
            <input
              type="date"
              value={query.from}
              max={query.to || undefined}
              onChange={(event) => patch({ from: event.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={query.to}
              min={query.from || undefined}
              onChange={(event) => patch({ to: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      <div className="history-search">
        <label className="history-search-field">
          <span className="history-search-icon" aria-hidden="true">
            <Search size={14} />
          </span>
          <input
            type="search"
            value={query.search}
            placeholder="Search reference, team, competition, market"
            aria-label="Search your history"
            onChange={(event) => patch({ search: event.target.value })}
          />
          {query.search ? (
            <button type="button" className="history-search-clear" aria-label="Clear search" onClick={() => patch({ search: "" })}>
              <X size={13} />
            </button>
          ) : null}
        </label>

        <label className="history-sort">
          <span>Sort</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as HistorySortKey)}>
            {HISTORY_SORTS.map((option) => (
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
