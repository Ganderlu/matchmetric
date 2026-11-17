import type { SelectionSource } from "@/types/slip";

/**
 * Shared shapes for the Insights analytics payload.
 *
 * Deliberately free of `server-only` so the Insights screen can type what it fetches. Every
 * percentage below is derived from recorded, graded history: `My Performance` is graded from
 * the user's own saved selections, `MatchMetric Performance` from the engine's archived
 * recommendations. The two datasets are computed separately and are never merged.
 */

export type InsightsRangeKey = "today" | "7d" | "30d" | "3m" | "6m" | "all" | "custom";
export type InsightsGrain = "hour" | "day" | "week" | "month";
export type InsightsTab = "mine" | "engine";

export interface InsightsRange {
  key: InsightsRangeKey;
  label: string;
  grain: InsightsGrain;
}

/** Won / lost / push / void counts plus a win rate over the decisive sample only. */
export interface PerformanceCount {
  /** Decisive selections: outright wins plus losses. Pushes and voids are excluded. */
  settled: number;
  won: number;
  lost: number;
  push: number;
  voided: number;
  /** `won / settled` as a percentage, or 0 when nothing is decisive. */
  winRate: number;
}

/** Selection-level summary for the active filter window. */
export interface PersonalSummary extends PerformanceCount {
  /** Saved prediction entries inside the window. */
  entries: number;
  /** Every individual selection considered, including pushes, voids and open picks. */
  selections: number;
  /** Selections whose match has no final score yet. Excluded from the win rate. */
  open: number;
  /** Selections that could not be graded from the recorded data. Excluded entirely. */
  unevaluable: number;
}

export interface BreakdownRow extends PerformanceCount {
  key: string;
  label: string;
  /** False when `settled` is below the reliability threshold. */
  reliable: boolean;
}

export interface TrendPoint {
  key: string;
  label: string;
  won: number;
  lost: number;
  settled: number;
  /** Selections recorded in the bucket, whatever their outcome. */
  selections: number;
  winRate: number;
}

export interface SourceBreakdown {
  source: SelectionSource;
  label: string;
  /** Selections recorded from this method inside the window. */
  recorded: number;
  settled: number;
  won: number;
  lost: number;
  winRate: number;
}

/** The user's final pick measured against the engine's original recommendation. */
export interface ComparisonSummary {
  /** Selections where the user's own choice was recorded. */
  tracked: number;
  /** Selections where both sides resolved to a decisive outcome. */
  comparable: number;
  same: number;
  changed: number;
  alternativeWon: number;
  recommendationWon: number;
  bothWon: number;
  bothLost: number;
  /** Tracked selections missing a decisive outcome on one side. */
  unavailable: number;
}

export interface PersonalInsights {
  summary: PersonalSummary;
  /** Multi-match entry outcomes, kept apart from individual selection accuracy. */
  entryLevel: PerformanceCount;
  trend: TrendPoint[];
  byMarket: BreakdownRow[];
  byCompetition: BreakdownRow[];
  bySource: SourceBreakdown[];
  comparison: ComparisonSummary;
  observations: string[];
  notes: string[];
  configured: boolean;
}

export interface CalibrationBucket {
  key: string;
  label: string;
  predictions: number;
  /** Mean stated probability for the bucket, as a percentage. */
  averageProbability: number;
  /** Share of the bucket that actually won, as a percentage. */
  observedRate: number;
  reliable: boolean;
}

export interface EngineMarketRow {
  key: string;
  label: string;
  /** Graded plus still-pending predictions recorded for this market. */
  generated: number;
  settled: number;
  won: number;
  lost: number;
  hitRate: number;
  /** Brier score over decisive predictions, or null when none are decisive. */
  brier: number | null;
  logLoss: number | null;
  reliable: boolean;
}

export interface EngineCompetitionRow {
  key: string;
  label: string;
  generated: number;
  settled: number;
  won: number;
  lost: number;
  hitRate: number;
  coverage: "good" | "limited" | "insufficient";
}

export interface ModelVersionRow {
  version: string;
  from: string | null;
  to: string | null;
  generated: number;
  settled: number;
  won: number;
  hitRate: number;
  brier: number | null;
  logLoss: number | null;
}

export interface EngineCoverage {
  competitions: number;
  marketsEvaluated: number;
  marketsLimited: number;
  /** Predictions excluded from evaluation: voids plus anything unresolved. */
  excluded: number;
}

export interface EngineInsights {
  configured: boolean;
  settled: number;
  won: number;
  lost: number;
  push: number;
  voided: number;
  pending: number;
  hitRate: number;
  brier: number | null;
  logLoss: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  byMarket: EngineMarketRow[];
  byCompetition: EngineCompetitionRow[];
  calibration: CalibrationBucket[];
  models: ModelVersionRow[];
  coverage: EngineCoverage;
  notes: string[];
  notice?: string;
}

export interface InsightsFilterOption {
  key: string;
  label: string;
}

export interface InsightsFilters {
  competitions: InsightsFilterOption[];
  markets: InsightsFilterOption[];
}

export interface InsightsPayload {
  personal: PersonalInsights;
  engine: EngineInsights;
  filters: InsightsFilters;
  range: InsightsRange;
  generatedAt: string;
}

/** Minimum decisive sample before a breakdown row is presented as reliable. */
export const MIN_RELIABLE_SAMPLE = 10;
/** Minimum decisive sample before a calibration bucket is presented as reliable. */
export const MIN_CALIBRATION_SAMPLE = 20;
