import type { MarketCategoryKey, MatchStatus } from "@/lib/football/types";
import type { TeamView } from "@/lib/football/views";
import type {
  PredictionAnalysisStatus,
  PredictionConfidence,
  PredictionDataQuality,
} from "@/lib/manual-predictions";
import type { SelectionSource } from "@/types/slip";

/**
 * Shared shapes for the Open Games payload.
 *
 * Open Games holds every prediction entry a member has saved from the Game Slip, whatever its
 * state: upcoming, in play, or already decided. Each entry keeps the two records apart that must
 * never be conflated — the engine's original recommendation and the selection the member finally
 * saved — together with the odds and probability recorded at that moment. The live score travels
 * beside the saved prediction and never rewrites it.
 *
 * This module is deliberately free of `server-only` so the page can type the JSON it receives.
 */

/** The overall state of one saved entry. */
export type OpenGamesStatus = "open" | "live" | "won" | "lost" | "voided";

/** The status filter. Prefers `open` on first visit when pending entries exist. */
export type OpenGamesStatusFilter = "all" | OpenGamesStatus;

/** The sort options offered beside the list. */
export type OpenGamesSortKey = "recent" | "oldest" | "kickoff" | "settled";

/** Graded state of one selection inside an entry. */
export type OpenGamesLegOutcome = "won" | "lost" | "push" | "void" | "open" | "unevaluable";

/** How an entry's selections entered the slip. `mixed` covers an entry using more than one method. */
export type OpenGamesEntrySource = SelectionSource | "mixed" | "unknown";

/** The engine's recommendation exactly as it was recorded, never rewritten. */
export interface OpenGamesRecommendation {
  marketKey: MarketCategoryKey | null;
  marketLabel: string;
  selection: string;
  estimatedProbability: number | null;
  /** The odds the engine recorded for its recommendation at analysis time. */
  odds: number | null;
  generatedAt: string;
}

/** The selection the member actually saved, with the values recorded at that moment. */
export interface OpenGamesFinalSelection {
  marketLabel: string;
  selection: string;
  /** Odds exactly as recorded when the entry was saved, or null when none were stored. */
  odds: number | null;
  /** Estimated probability exactly as recorded when the entry was saved, or null. */
  probability: number | null;
  source: SelectionSource | "unknown";
}

/** The analysis snapshot preserved alongside the recommendation. */
export interface OpenGamesAnalysis {
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

/**
 * One match inside an entry.
 *
 * Everything down to `analysis` is the saved prediction, frozen at save time. Everything from
 * `matchStatus` down is the current live picture read from MatchMetric's own match feed; it is
 * shown next to the prediction and never folded back into it.
 */
export interface OpenGamesMatch {
  fixtureId: string;
  competition: string;
  kickoff: string;
  home: TeamView;
  away: TeamView;
  marketKey: MarketCategoryKey | "other";
  marketLabel: string;
  selection: string;
  outcome: OpenGamesLegOutcome;
  /** True when the member recorded their own pick for this fixture. */
  recorded: boolean;
  /** True when that pick differs from the engine's recommendation. */
  overridden: boolean;
  recommendation: OpenGamesRecommendation | null;
  finalSelection: OpenGamesFinalSelection;
  /** The engine's own graded outcome for this fixture, when it was graded. */
  engineOutcome: "won" | "lost" | "push" | null;
  analysis: OpenGamesAnalysis | null;

  /* ---- live state, read from the match feed ---- */
  matchStatus: MatchStatus;
  /** The provider's own status label, e.g. "2nd half". Empty when nothing is cached. */
  statusLabel: string;
  /** Minute in play, only populated when the provider reports one. */
  minute: number | null;
  /** The running score while the match is in play. */
  liveScore: { home: number | null; away: number | null } | null;
  /** The final score, once it is known from either the ledger or the feed. */
  finalScore: { home: number; away: number } | null;
  /** When this match's live state was last captured, or null when nothing is cached. */
  liveUpdatedAt: string | null;
}

/** One saved prediction entry. */
export interface OpenGamesEntry {
  id: string;
  /** The record's own identity, presented as the prediction reference. */
  reference: string;
  savedAt: string;
  settledAt: string | null;
  /** Saved instant in milliseconds, used for the saved-date sorts. */
  dateMs: number;
  /** Earliest kickoff still to come, used for the kickoff sort. 0 when nothing is pending. */
  pendingKickoffMs: number;
  matchCount: number;
  source: OpenGamesEntrySource;
  sourceLabel: string;
  modelVersion: string;
  status: OpenGamesStatus;
  matches: OpenGamesMatch[];
  wonMatches: number;
  lostMatches: number;
  voidedMatches: number;
  openMatches: number;
  liveMatches: number;
}

/** The compact summary above the filters. */
export interface OpenGamesSummary {
  /** Every saved entry in view. */
  totalEntries: number;
  /** Entries with a decided result (won or lost). */
  completedEntries: number;
  /** Entries still waiting on a kickoff. */
  openEntries: number;
  /** Entries with at least one match in play. */
  liveEntries: number;
  won: number;
  lost: number;
  voided: number;
  /** `won / (won + lost)` as a percentage, or 0 when nothing is decided. */
  winRate: number;
  /** Match-level counts across every entry in view. */
  totalMatches: number;
  upcomingMatches: number;
  liveMatches: number;
  completedMatches: number;
}

export interface OpenGamesCounts {
  all: number;
  open: number;
  live: number;
  won: number;
  lost: number;
  voided: number;
}

export interface OpenGamesPayload {
  configured: boolean;
  entries: OpenGamesEntry[];
  summary: OpenGamesSummary;
  counts: OpenGamesCounts;
  generatedAt: string;
  notice?: string;
}

/** The sort options, in the order they are offered. */
export const OPEN_GAMES_SORTS: { key: OpenGamesSortKey; label: string }[] = [
  { key: "recent", label: "Most recently saved" },
  { key: "oldest", label: "Oldest saved" },
  { key: "kickoff", label: "Upcoming kickoff" },
  { key: "settled", label: "Recently settled" },
];
