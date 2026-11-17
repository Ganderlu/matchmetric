"use client";

import { Activity, Compass, Filter, Lightbulb, LineChart, Repeat, ShieldCheck, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { BreakdownRow, PersonalInsights, SourceBreakdown } from "@/lib/insights/types";
import { MIN_RELIABLE_SAMPLE } from "@/lib/insights/types";
import { EmptyState, InsightCard, InsightsTable, NoteList, RateCell, SampleFlag, StatTile, type TableRow } from "./parts";
import { TrendChart, type TrendMetric } from "./TrendChart";

/**
 * "My Performance" — the member's own saved history.
 *
 * Selection accuracy and multi-match entry success are reported side by side and never merged:
 * an entry only wins when every settled leg wins, so its rate is not the same statistic as the
 * per-selection win rate.
 */

const METRICS: { key: TrendMetric; label: string }[] = [
  { key: "winRate", label: "Win rate" },
  { key: "settled", label: "Settled" },
  { key: "selections", label: "Selections" },
];

function pct(value: number, settled: number): string {
  return settled > 0 ? `${value.toFixed(1)}%` : "—";
}

export function PersonalInsightsPanel({
  personal,
  filterActive,
}: {
  personal: PersonalInsights;
  filterActive: boolean;
}) {
  const [metric, setMetric] = useState<TrendMetric>("winRate");

  if (!personal.configured) {
    return (
      <InsightCard icon={Activity} title="My Performance">
        <EmptyState
          icon={Activity}
          title="Performance data is still building."
          message="Graded history needs a configured server store. Once it is available, your saved predictions are graded here automatically."
        />
      </InsightCard>
    );
  }

  const { summary, entryLevel, comparison } = personal;

  if (summary.selections === 0) {
    return (
      <InsightCard icon={Activity} title="My Performance" description="Your own saved prediction history.">
        {filterActive ? (
          <EmptyState
            icon={Filter}
            title="Nothing to show in this range"
            message="No saved selection in your history falls inside this date range and filter combination. Widen the range, clear the filters, or save a prediction to Open Games."
            action={
              <Link className="primary-button" href="/">
                Explore Matches
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Target}
            title="Your Insights Are Growing"
            message="Save a prediction to Open Games and its graded result appears here after full time. Nothing is estimated while the history is empty."
            action={
              <Link className="primary-button" href="/">
                Explore Matches
              </Link>
            }
          />
        )}
      </InsightCard>
    );
  }

  const comparable = comparison.comparable;

  return (
    <>
      <InsightCard
        icon={Trophy}
        title="Performance summary"
        description="Your settled selections in this window, with the sample behind every rate."
      >
        <div className="insights-stat-grid">
          <StatTile
            label="Selection win rate"
            value={pct(summary.winRate, summary.settled)}
            hint={`${summary.settled} settled selections`}
            tone="positive"
          />
          <StatTile
            label="Entry success"
            value={pct(entryLevel.winRate, entryLevel.settled)}
            hint={`${entryLevel.settled} settled entries`}
          />
          <StatTile label="Won" value={String(summary.won)} hint={`of ${summary.selections} selections`} />
          <StatTile label="Lost" value={String(summary.lost)} hint={`${summary.settled} settled`} />
          <StatTile
            label="Void / push"
            value={`${summary.voided} / ${summary.push}`}
            hint="excluded from the win rate"
            tone="muted"
          />
          <StatTile
            label="Awaiting result"
            value={String(summary.open)}
            hint={summary.unevaluable ? `${summary.unevaluable} not gradable` : "graded at full time"}
            tone="muted"
          />
        </div>
        <NoteList
          notes={[
            "Selection win rate counts individual picks. Entry success counts saved multi-match entries, which only win when every settled leg wins — they are different statistics and are shown separately.",
          ]}
        />
      </InsightCard>

      <InsightCard
        icon={LineChart}
        title="Performance Over Time"
        description="Each point is one time bucket from your recorded history."
        action={
          <div className="insights-metric-toggle" role="group" aria-label="Trend metric">
            {METRICS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={metric === key}
                className={`insights-chip ${metric === key ? "active" : ""}`}
                onClick={() => setMetric(key)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <TrendChart points={personal.trend} metric={metric} />
      </InsightCard>

      <InsightCard
        icon={Target}
        title="Performance by Market"
        description="How each market you record has settled."
      >
        <InsightsTable
          columns={["Market", "Settled", "W / L", "Win rate"]}
          rows={personal.byMarket.map((row) => marketRow(row))}
          footnote="Rows with fewer than ten settled selections are marked as a low sample and should not be read as a pattern."
        />
      </InsightCard>

      <InsightCard
        icon={Compass}
        title="Performance by League"
        description="The competitions your settled selections come from."
      >
        <InsightsTable
          columns={["Competition", "Settled", "W / L", "Win rate"]}
          rows={personal.byCompetition.map((row) => competitionRow(row))}
          footnote="A competition only appears once you have recorded a selection in it."
        />
      </InsightCard>

      <InsightCard
        icon={Repeat}
        title="How You Select Games"
        description="Your settled record split by how each pick entered the slip."
      >
        {personal.bySource.length ? (
          <ul className="insights-source-list">
            {personal.bySource.map((source) => (
              <SourceRow key={source.source} source={source} />
            ))}
          </ul>
        ) : (
          <p className="insights-inline-note">
            Your saved entries do not carry a selection method yet, so there is nothing to compare here.
          </p>
        )}
      </InsightCard>

      <InsightCard
        icon={ShieldCheck}
        title="Your Picks vs MatchMetric"
        description="Where you kept the engine's recommendation and where you chose differently."
      >
        <div className="insights-stat-grid">
          <StatTile label="Recorded picks" value={String(comparison.tracked)} hint="with your own choice saved" />
          <StatTile label="Kept the recommendation" value={String(comparison.same)} hint={`of ${comparable} comparable`} />
          <StatTile label="Chose differently" value={String(comparison.changed)} hint={`of ${comparable} comparable`} />
          <StatTile
            label="Your pick won instead"
            value={String(comparison.alternativeWon)}
            hint="where you replaced the pick"
            tone="positive"
          />
          <StatTile
            label="Recommendation would have won"
            value={String(comparison.recommendationWon)}
            hint="where you replaced the pick"
            tone="negative"
          />
          <StatTile
            label="Not comparable"
            value={String(comparison.unavailable)}
            hint="one side not decisive yet"
            tone="muted"
          />
        </div>
        <p className="insights-inline-note">
          {comparable === 0
            ? "No recorded pick has a decisive outcome on both sides yet, so nothing is being claimed about this comparison."
            : comparison.changed === 0
              ? `You kept MatchMetric's original recommendation in every one of your ${comparison.tracked} recorded picks.`
              : `You replaced MatchMetric's recommendation in ${comparison.changed} of ${comparison.tracked} recorded picks. Only selections that are decisive on both sides are counted above.`}
        </p>
      </InsightCard>

      <InsightCard
        icon={Lightbulb}
        title="Your Insights"
        description="Observations drawn only from samples large enough to support them."
      >
        <ul className="insights-observation-list">
          {personal.observations.map((observation) => (
            <li key={observation}>
              <Lightbulb size={13} />
              <span>{observation}</span>
            </li>
          ))}
        </ul>
      </InsightCard>

      <NoteList notes={personal.notes} />
    </>
  );
}

function marketRow(row: BreakdownRow): TableRow {
  return {
    id: row.key,
    cells: [
      <span key="label" className="insights-table-name">
        {row.label}
        {row.reliable ? null : <em>low sample</em>}
      </span>,
      String(row.settled),
      `${row.won} / ${row.lost}`,
      <RateCell key="rate" rate={row.winRate} settled={row.settled} reliable={row.reliable} />,
    ],
  };
}

function competitionRow(row: BreakdownRow): TableRow {
  return {
    id: row.key,
    cells: [
      <span key="label" className="insights-table-name">
        {row.label}
        {row.reliable ? null : <em>low sample</em>}
      </span>,
      String(row.settled),
      `${row.won} / ${row.lost}`,
      <RateCell key="rate" rate={row.winRate} settled={row.settled} reliable={row.reliable} />,
    ],
  };
}

function SourceRow({ source }: { source: SourceBreakdown }) {
  return (
    <li className="insights-source-row">
      <div className="insights-source-copy">
        <strong>{source.label}</strong>
        <span>
          {source.recorded} recorded · {source.won}W / {source.lost}L
        </span>
      </div>
      <div className="insights-source-rate">
        <strong>{source.settled > 0 ? `${source.winRate.toFixed(1)}%` : "—"}</strong>
        <SampleFlag reliable={source.settled >= MIN_RELIABLE_SAMPLE} settled={source.settled} />
      </div>
    </li>
  );
}
