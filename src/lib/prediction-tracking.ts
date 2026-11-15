import type { MarketCategoryKey } from "@/lib/football/types";
import type {
  PredictionConfidence,
  PredictionDataQuality,
  SettlementTarget,
} from "@/lib/manual-predictions";

/**
 * Shapes for the central prediction store and its accuracy ledger.
 *
 * This module is deliberately free of `server-only` so the account workspace can type the
 * accuracy payload it receives. A pick is described by a `RecordedPrediction`; once the
 * match reaches full time it is graded into a `SettledPrediction`. Nothing here is
 * fabricated: a pick without a final score stays ungraded and is excluded from accuracy.
 */

/** How a graded pick resolved once the match finished. */
export type PredictionOutcome = "won" | "lost" | "push" | "void";

/** A single recommendation the engine recorded before kickoff. */
export interface RecordedPrediction {
  fixtureId: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  modelVersion: string;
  market: MarketCategoryKey;
  marketLabel: string;
  selection: string;
  /** Canonical grading target resolved from the provider's selection label. */
  settlement: SettlementTarget;
  odds: number;
  estimatedProbability: number;
  confidence: PredictionConfidence | null;
  dataQuality: PredictionDataQuality;
  generatedAt: string;
}

/** A recorded pick graded against the final score. */
export interface SettledPrediction extends RecordedPrediction {
  outcome: PredictionOutcome;
  /** Null when the pick was voided (postponed or cancelled) before a score existed. */
  homeScore: number | null;
  awayScore: number | null;
  /** Profit for a single unit stake: `odds - 1` won, `-1` lost, `0` push/void. */
  profit: number;
  settledAt: string;
}

/** Accuracy rolled up for one market category. */
export interface MarketAccuracy {
  market: MarketCategoryKey;
  marketLabel: string;
  settled: number;
  won: number;
  lost: number;
  push: number;
  /** Percentage of graded, non-push picks that won. */
  hitRate: number;
  /** Return on a single unit stake, as a percentage. */
  roi: number;
}

export interface AccuracySummary {
  /** False when the server has no Firestore/Admin credentials, so nothing can be tracked. */
  configured: boolean;
  settled: number;
  won: number;
  lost: number;
  push: number;
  voided: number;
  pending: number;
  hitRate: number;
  roi: number;
  averageOdds: number;
  modelVersion: string;
  byMarket: MarketAccuracy[];
  /** Most recently graded picks, newest first. */
  recent: SettledPrediction[];
  lastSettledAt: string | null;
  generatedAt: string;
  notice?: string;
}
