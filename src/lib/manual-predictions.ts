import type { MarketCategoryKey } from "@/lib/football/types";
import type { TeamView } from "@/lib/football/views";

export type PredictionConfidence = "High" | "Medium" | "Low";
export type PredictionDataQuality = "Good" | "Limited" | "Insufficient";
export type PredictionAnalysisStatus = "recommended" | "no-value" | "insufficient";

export interface EvaluatedMarket {
  category: MarketCategoryKey;
  market: string;
  selection: string;
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
  modelVersion: string;
  generatedAt: string;
  createdAt: string;
}
