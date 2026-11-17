import type { MarketCategoryKey } from "@/lib/football/types";
import type { TeamView } from "@/lib/football/views";

export type PredictionConfidence = "High" | "Medium" | "Low";
export type PredictionDataQuality = "Good" | "Limited" | "Insufficient";
export type PredictionAnalysisStatus = "recommended" | "no-value" | "insufficient";

/**
 * A settlement target is the canonical, provider-independent description of a pick.
 *
 * The engine matches a provider's own selection label ("1", "Home or Draw", "Over 2.5")
 * onto one of these, so a saved recommendation can later be graded against the final
 * score without depending on how any single bookmaker happened to name the selection.
 */
export type SettlementTarget =
  | { market: "1x2"; side: "home" | "draw" | "away" }
  | { market: "double-chance"; side: "home-draw" | "home-away" | "away-draw" }
  | { market: "dnb"; side: "home" | "away" }
  | { market: "btts"; side: "yes" | "no" }
  | { market: "over-under"; side: "over" | "under"; line: number };

export interface EvaluatedMarket {
  category: MarketCategoryKey;
  market: string;
  selection: string;
  /** Canonical grading target for the selection, used by accuracy tracking. */
  settlement: SettlementTarget;
  estimatedProbability: number;
  impliedProbability: number;
  odds: number;
  expectedValue: number;
}

export interface ManualPredictionResult {
  fixtureId: string;
  homeTeam: TeamView;
  awayTeam: TeamView;
  leagueName: string;
  kickoff: string;
  analysisStatus: PredictionAnalysisStatus;
  recommendedMarket: MarketCategoryKey | null;
  marketLabel: string | null;
  recommendedSelection: string | null;
  /** Canonical grading target for the recommendation, or null when there is no pick. */
  recommendedSettlement: SettlementTarget | null;
  estimatedProbability: number | null;
  confidence: PredictionConfidence | null;
  availableOdds?: number;
  expectedValue?: number;
  dataQuality: PredictionDataQuality;
  homeFormSummary: string;
  awayFormSummary: string;
  keyInsights: string[];
  weakeningFactors: string[];
  bestAvailableMarkets: EvaluatedMarket[];
  modelVersion: string;
  generatedAt: string;
}

export interface SavedManualPrediction {
  id: string;
  fixtureIds: string[];
  results: ManualPredictionResult[];
  /** The user's final choice per fixture, kept apart from the engine's recommendation. */
  selections?: SavedSelectionRecord[];
  modelVersion: string;
  generatedAt: string;
  createdAt: string;
}

/**
 * The selection the user settled on when saving, with the method it came from.
 *
 * It is recorded alongside the engine's own `results` rather than replacing them, so the
 * ledger can always tell the recommendation and the user's final choice apart.
 */
export interface SavedSelectionRecord {
  fixtureId: string;
  market: string;
  selection: string;
  source: "manual" | "automatic" | "screenshot";
  odds?: number;
  probability?: number;
}
