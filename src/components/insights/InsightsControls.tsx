"use client";

import { CalendarRange, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import type { InsightsFilterOption, InsightsFilters, InsightsRangeKey, InsightsTab } from "@/lib/insights/types";
import type { SelectionSource } from "@/types/slip";
import type { InsightsQuery } from "@/hooks/use-insights";

/**
 * The two Insights datasets are chosen here and nowhere else.
 *
 * "My Performance" is the member's own saved history; "MatchMetric Performance" is the engine's
 * archived recommendations. They are separate datasets and are never combined into one figure.
 */

const TABS: { key: InsightsTab; label: string; hint: string }[] = [
  { key: "mine", label: "My Performance", hint: "Your saved predictions" },
  { key: "engine", label: "MatchMetric", hint: "The engine's record" },
];

const RANGES: { key: InsightsRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

const SOURCES: { key: SelectionSource; label: string }[] = [
  { key: "manual", label: "Manual selection" },
  { key: "automatic", label: "Automatic picks" },
  { key: "screenshot", label: "Screenshot import" },
];

export function InsightsControls({
  tab,
  onTab,
  query,
  onChange,
  filters,
}: {
  tab: InsightsTab;
  onTab: (tab: InsightsTab) => void;
  query: InsightsQuery;
  onChange: (next: InsightsQuery) => void;
  filters?: InsightsFilters;
}) {
  const patch = (partial: Partial<InsightsQuery>) => onChange({ ...query, ...partial });
  const hasFilters = Boolean(query.competition || query.market || query.source);

  return (
    <div className="insights-controls">
      <div className="segmented two insights-tabs" role="group" aria-label="Insights dataset">
        {TABS.map(({ key, label, hint }) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            className={`segment ${tab === key ? "active" : ""}`}
            onClick={() => onTab(key)}
          >
            <strong>{label}</strong>
            <small>{hint}</small>
          </button>
        ))}
      </div>

      <div className="insights-range" role="group" aria-label="Date range">
        <span className="insights-range-icon" aria-hidden="true">
          <CalendarRange size={14} />
        </span>
        <div className="insights-range-chips">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={query.range === key}
              className={`insights-chip ${query.range === key ? "active" : ""}`}
              onClick={() => patch({ range: key })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {query.range === "custom" ? (
        <div className="insights-custom-range">
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

      <div className="insights-filters">
        <span className="insights-filters-icon" aria-hidden="true">
          <SlidersHorizontal size={14} />
        </span>
        <FilterSelect
          label="Competition"
          value={query.competition}
          options={filters?.competitions ?? []}
          allLabel="All competitions"
          onChange={(value) => patch({ competition: value })}
        />
        <FilterSelect
          label="Market"
          value={query.market}
          options={filters?.markets ?? []}
          allLabel="All markets"
          onChange={(value) => patch({ market: value })}
        />
        {tab === "mine" ? (
          <label className="insights-filter">
            <span>Source</span>
            <select value={query.source} onChange={(event) => patch({ source: event.target.value as SelectionSource | "" })}>
              <option value="">All sources</option>
              {SOURCES.map((source) => (
                <option key={source.key} value={source.key}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {hasFilters ? (
          <button
            type="button"
            className="insights-filter-clear"
            onClick={() => patch({ competition: "", market: "", source: "" })}
          >
            <X size={13} /> Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: InsightsFilterOption[];
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="insights-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={!options.length}>
        <option value="">{options.length ? allLabel : "No data yet"}</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Honest footnote: what the numbers cover and what they deliberately leave out. */
export function InsightsScopeNote({ rangeLabel }: { rangeLabel: string }) {
  return (
    <p className="insights-scope-note">
      Showing <strong>{rangeLabel}</strong>. Every figure is calculated from recorded, graded history.
      Voided selections and pushes are excluded from win rates, and matches awaiting a result are never
      graded early. <Link href="/history">Review your history</Link>.
    </p>
  );
}
