import type { MarketCategoryKey } from "@/lib/football/types";
import type { TeamView } from "@/lib/football/views";
import type {
  PredictionAnalysisStatus,
  PredictionConfidence,
  PredictionDataQuality,
} from "@/lib/manual-predictions";
import type { SelectionSource } from "@/types/slip";

/**
 * Shared shapes for the History payload.
 *
 * History shows completed records only: an entry appears here once every one of its selections
 * has a result. Open and live entries belong to Open Games and are never duplicated here. The
 * shapes deliberately carry both the engine's original recommendation and the member's own final
 * selection, plus the odds and probability that were recorded when the entry was saved, so the
 * two are never conflated and nothing is recalculated after the fact.
 */

/** The settled outcome of a whole entry. Open and unevaluable entries are not shown at all. */
export type HistoryStatus = "won" | "lost" | "voided";

/** The status chip filter. `all` is the default. */
export type HistoryStatusFilter = "all" | HistoryStatus;

/** The sort options offered beside the list. */
export type HistorySortKey = "recent" | "oldest" | "most-matches" | "won-first" | "lost-first";

/** The date filter options. */
export type HistoryRangeKey = "today" | "7d" | "30d" | "3m" | "custom" | "all";

/** Graded state of one selection inside an entry. */
export type HistoryLegOutcome = "won" | "lost" | "push" | "void" | "open" | "unevaluable";

/** How an entry's selections entered the slip. `mixed` covers an entry with more than one method. */
export type HistoryEntrySource = SelectionSource | "mixed" | "unknown";

/** The engine's recommendation as it was recorded, never rewritten. */
export interface HistoryRecommendation {
  marketKey: MarketCategoryKey | null;
  marketLabel: string;
  selection: string;
  estimatedProbability: number | null;
  /** The odds the engine recorded for its recommendation at analysis time. */
  odds: number | null;
  generatedAt: string;
}

/** The selection the member actually saved, with the values recorded at that moment. */
export interface HistoryFinalSelection {
  marketLabel: string;
  selection: string;
  /** Odds exactly as recorded when the entry was saved, or null when none were stored. */
  odds: number | null;
  /** Estimated probability exactly as recorded when the entry was saved, or null. */
  probability: number | null;
  source: SelectionSource | "unknown";
}

/** The historical analysis snapshot preserved alongside the recommendation. */
export interface HistoryAnalysis {
  status: PredictionAnalysisStatus | null;
  confidence: PredictionConfidence | null;
  dataQuality: PredictionDataQuality | null;
  estimatedProbability: number | null;
  availableOdds: number | null;
  homeForm: string;
  awayForm: string;
  keyInsights: string[];
  weakeningFactors: string[];
}

/** One match inside an entry, with its own result kept visible whatever the entry's outcome. */
export interface HistoryMatch {
  fixtureId: string;
  competition: string;
  kickoff: string;
  home: TeamView;
  away: TeamView;
  finalScore: { home: number; away: number } | null;
  settledAt: string | null;
  marketKey: MarketCategoryKey | "other";
  marketLabel: string;
  selection: string;
  outcome: HistoryLegOutcome;
  /** True when the member recorded their own pick for this fixture. */
  recorded: boolean;
  /** True when that pick differs from the engine's recommendation. */
  overridden: boolean;
  recommendation: HistoryRecommendation | null;
  finalSelection: HistoryFinalSelection;
  /** The engine's own graded outcome for this fixture, when it was graded. */
  engineOutcome: "won" | "lost" | "push" | null;
  analysis: HistoryAnalysis | null;
}

/** A completed prediction entry. */
export interface HistoryEntry {
  id: string;
  /** The record's own identity, presented as the prediction reference. */
  reference: string;
  savedAt: string;
  settledAt: string | null;
  /** Settlement instant used for range filtering, falling back to the saved date. */
  dateMs: number;
  matchCount: number;
  source: HistoryEntrySource;
  sourceLabel: string;
  modelVersion: string;
  status: HistoryStatus;
  matches: HistoryMatch[];
  wonMatches: number;
  lostMatches: number;
  voidedMatches: number;
}

/** Entry-level performance. Kept apart from match-level accuracy below. */
export interface HistorySummary {
  /** Entries that were decided: wins plus losses. Voided entries are excluded. */
  settledEntries: number;
  won: number;
  lost: number;
  voided: number;
  /** `won / settledEntries` as a percentage, or 0 when nothing is decided. */
  winRate: number;
  /** Match-level outcome across every selection inside the entries above. */
  matchesSettled: number;
  matchesWon: number;
}

export interface HistoryStatusCounts {
  all: number;
  won: number;
  lost: number;
  voided: number;
}

export interface HistoryPayload {
  configured: boolean;
  entries: HistoryEntry[];
  summary: HistorySummary;
  counts: HistoryStatusCounts;
  generatedAt: string;
  notice?: string;
}

/** The four date filters, in the order they are offered. */
export const HISTORY_RANGES: { key: HistoryRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "custom", label: "Custom range" },
  { key: "all", label: "All time" },
];

/** The sort options, in the order they are offered. */
export const HISTORY_SORTS: { key: HistorySortKey; label: string }[] = [
  { key: "recent", label: "Most recent first" },
  { key: "oldest", label: "Oldest first" },
  { key: "most-matches", label: "Highest number of matches" },
  { key: "won-first", label: "Won first" },
  { key: "lost-first", label: "Lost first" },
];
