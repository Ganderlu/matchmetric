"use client";

import { BarChart3, Database, GitBranch, Gauge, Globe2, Target } from "lucide-react";
import type { EngineCompetitionRow, EngineInsights, EngineMarketRow, ModelVersionRow } from "@/lib/insights/types";
import { MIN_RELIABLE_SAMPLE } from "@/lib/insights/types";
import { CalibrationChart } from "./CalibrationChart";
import { EmptyState, InsightCard, InsightsTable, NoteList, RateCell, StatTile, type TableRow } from "./parts";

/**
 * "MatchMetric Performance" — the engine's own archived record.
 *
 * Every prediction counted here was recorded before kickoff from the probability the engine
 * stated at the time, then graded from the final score. Post-match information is never
 * presented as a prediction, and probabilities are never rewritten after the fact.
 */

const COVERAGE_LABEL: Record<EngineCompetitionRow["coverage"], string> = {
  good: "Good coverage",
  limited: "Limited sample",
  insufficient: "Insufficient",
};

function dec(value: number | null, digits = 4): string {
  return value === null ? "—" : value.toFixed(digits);
}

function date(iso: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
}

export function EngineInsightsPanel({ engine }: { engine: EngineInsights }) {
  if (!engine.configured) {
    return (
      <InsightCard icon={BarChart3} title="MatchMetric Engine Performance">
        <EmptyState
          icon={BarChart3}
          title="Performance data is still building."
          message={engine.notice ?? "The engine ledger needs a configured server store before its record can be summarised."}
        />
      </InsightCard>
    );
  }

  if (engine.settled === 0 && engine.pending === 0) {
    return (
      <InsightCard icon={BarChart3} title="MatchMetric Engine Performance" description="The central engine's archived record.">
        <EmptyState
          icon={Target}
          title="Performance data is still building."
          message="No pre-match prediction has been graded yet. Each recommendation is recorded before kickoff and graded only from the final score, so this record cannot be backfilled."
        />
      </InsightCard>
    );
  }

  const period =
    engine.periodFrom && engine.periodTo
      ? `${date(engine.periodFrom)} – ${date(engine.periodTo)}`
      : "No graded predictions in this window";

  return (
    <>
      <InsightCard
        icon={BarChart3}
        title="MatchMetric Engine Performance"
        description={`Archived pre-match predictions, graded from final scores. ${period}`}
      >
        <div className="insights-stat-grid">
          <StatTile
            label="Hit rate"
            value={engine.settled > 0 ? `${engine.hitRate.toFixed(1)}%` : "—"}
            hint={`${engine.settled} settled`}
            tone="positive"
          />
          <StatTile label="Won" value={String(engine.won)} hint={`${engine.settled} settled`} />
          <StatTile label="Lost" value={String(engine.lost)} hint={`${engine.settled} settled`} />
          <StatTile
            label="Brier score"
            value={dec(engine.brier)}
            hint="lower is better"
            tone="muted"
          />
          <StatTile
            label="Log loss"
            value={dec(engine.logLoss)}
            hint="lower is better"
            tone="muted"
          />
          <StatTile
            label="Awaiting result"
            value={String(engine.pending)}
            hint="recorded before kickoff"
            tone="muted"
          />
        </div>
        <NoteList
          notes={[
            "Brier score and log loss both compare the probability the engine stated at prediction time with what actually happened. Lower is better, and neither can be improved by rewriting a pick after full time.",
          ]}
        />
      </InsightCard>

      <InsightCard
        icon={Target}
        title="Engine Performance by Market"
        description="Graded record for each market the engine recommends."
      >
        <InsightsTable
          columns={["Market", "Generated", "Settled", "Hit rate", "Brier", "Log loss"]}
          rows={engine.byMarket.map(marketRow)}
          footnote="Hit rate ignores pushes and voids. Brier score and log loss are shown only where there is a decisive sample."
        />
      </InsightCard>

      <InsightCard
        icon={Globe2}
        title="Engine Performance by Competition"
        description="Where the engine has generated and graded predictions."
      >
        <InsightsTable
          columns={["Competition", "Generated", "Settled", "Hit rate", "Coverage"]}
          rows={engine.byCompetition.map(competitionRow)}
          footnote="Coverage reflects how much decisive evidence exists in each competition, not how well the engine is expected to do."
        />
      </InsightCard>

      <InsightCard
        icon={Gauge}
        title="Prediction Calibration"
        description="Stated probability against the share that actually won."
      >
        {engine.calibration.length ? (
          <CalibrationChart buckets={engine.calibration} />
        ) : (
          <p className="insights-inline-note">
            There are no graded predictions with a stated probability in this window yet.
          </p>
        )}
      </InsightCard>

      <InsightCard
        icon={GitBranch}
        title="Model Development"
        description="Each model version and its graded record."
      >
        {engine.models.length ? (
          <InsightsTable
            columns={["Model version", "First graded", "Last graded", "Settled", "Hit rate"]}
            rows={engine.models.map(modelRow)}
            footnote="A new version is only comparable once it has enough graded predictions of its own; a strong start on a few picks is not evidence of an improvement."
          />
        ) : (
          <p className="insights-inline-note">No model version has a graded prediction in this window.</p>
        )}
      </InsightCard>

      <InsightCard
        icon={Database}
        title="Data Quality and Coverage"
        description="What this record does and does not cover."
      >
        <div className="insights-stat-grid">
          <StatTile label="Competitions covered" value={String(engine.coverage.competitions)} hint="with graded picks" />
          <StatTile
            label="Markets evaluated"
            value={String(engine.coverage.marketsEvaluated)}
            hint="with a decisive sample"
          />
          <StatTile
            label="Markets with a limited sample"
            value={String(engine.coverage.marketsLimited)}
            hint="below ten settled picks"
            tone="muted"
          />
          <StatTile
            label="Excluded from evaluation"
            value={String(engine.coverage.excluded)}
            hint={`${engine.voided} void · ${engine.pending} awaiting`}
            tone="muted"
          />
        </div>
        <NoteList notes={engine.notes} />
      </InsightCard>
    </>
  );
}

function marketRow(row: EngineMarketRow): TableRow {
  return {
    id: row.key,
    cells: [
      <span key="label" className="insights-table-name">
        {row.label}
        {row.reliable ? null : <em>low sample</em>}
      </span>,
      String(row.generated),
      String(row.settled),
      <RateCell key="rate" rate={row.hitRate} settled={row.settled} reliable={row.reliable} />,
      dec(row.brier),
      dec(row.logLoss),
    ],
  };
}

function competitionRow(row: EngineCompetitionRow): TableRow {
  return {
    id: row.key,
    cells: [
      <span key="label" className="insights-table-name">
        {row.label}
      </span>,
      String(row.generated),
      String(row.settled),
      <RateCell key="rate" rate={row.hitRate} settled={row.settled} reliable={row.coverage !== "insufficient"} />,
      <span key="coverage" className={`insights-coverage ${row.coverage}`}>
        {COVERAGE_LABEL[row.coverage]}
      </span>,
    ],
  };
}

function modelRow(row: ModelVersionRow): TableRow {
  return {
    id: row.version,
    cells: [
      <span key="version" className="insights-table-name">
        {row.version}
      </span>,
      date(row.from),
      date(row.to),
      String(row.settled),
      <RateCell key="rate" rate={row.hitRate} settled={row.settled} reliable={row.settled >= MIN_RELIABLE_SAMPLE} />,
    ],
  };
}
