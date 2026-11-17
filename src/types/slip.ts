import type { DataSource, MarketCategoryKey, ProviderName } from "@/lib/football/types";
import type {
  PredictionConfidence,
  PredictionDataQuality,
  SettlementTarget,
} from "@/lib/manual-predictions";

/**
 * The unified Game Slip model.
 *
 * Manual selection, automatic picks and screenshot import all commit entries into this one
 * shape. The `source` decides which controls a card renders, and the analysis fields are kept
 * apart on purpose:
 *
 * - `originalUserSelection` is what the user actually placed (screenshot import).
 * - `matchMetricRecommendation` is the engine's own pick and is never overwritten by a user
 *   choice.
 * - `userSelectedPrediction` is the selection the user finally settled on.
 *
 * Keeping those three separate is what lets the UI show a replacement without losing the
 * original recommendation or the user's original slip.
 */

export type SelectionSource = "manual" | "automatic" | "screenshot";

export type SlipEntryStatus = "pending" | "analysing" | "analysed" | "error";

export type SlipTab = "slip" | "auto";

export type SlipAnalysisStatus = "recommended" | "no-value" | "insufficient";

/** Outcome of replaying a screenshot selection against the engine's own pick. */
export type SlipComparisonStatus = "match" | "change" | "unverified";

export type AutoPickMode = "probability" | "value";

export interface SlipSelection {
  market: string;
  selection: string;
}

/** A priced, engine-evaluated selection. Every number here comes from the prediction engine. */
export interface SlipPrediction {
  category: MarketCategoryKey;
  market: string;
  marketLabel: string;
  selection: string;
  /** Model estimate, in percent (0-100). */
  probability: number;
  /** The provider price expressed as an implied probability, in percent. */
  impliedProbability: number;
  odds?: number;
  expectedValue?: number;
  settlement?: SettlementTarget;
}

export interface SlipComparison {
  status: SlipComparisonStatus;
  note: string;
}

export interface SlipEntry {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  leagueFlag?: string;
  kickoff: string;
  source: SelectionSource;
  status: SlipEntryStatus;
  provider?: ProviderName;
  /** False for demo or unconfigured fixtures, which the engine refuses to analyse. */
  analysable: boolean;
  addedAt: string;

  /** Screenshot import: the selection the user placed with their bookmaker. */
  originalUserSelection?: SlipSelection;
  /** The engine's own recommendation, preserved even after the user replaces it. */
  matchMetricRecommendation?: SlipPrediction;
  highestProbability: SlipPrediction[];
  bestValue: SlipPrediction[];
  /** The selection the user settled on. Falls back to the recommendation when unset. */
  userSelectedPrediction?: SlipSelection;
  analysisStatus?: SlipAnalysisStatus;
  analysisSource?: DataSource;
  dataQuality?: PredictionDataQuality;
  confidence?: PredictionConfidence;
  /** Why no recommendation was produced, or why analysis failed. */
  analysisNote?: string;
  comparison?: SlipComparison;
  modelVersion?: string;
  generatedAt?: string;
  /** Set once the entry has been saved to Open Games. */
  savedPredictionId?: string;
}

/** What a dashboard card hands to the slip when a match is added. */
export interface NewSlipEntry {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  leagueFlag?: string;
  kickoff: string;
  provider?: ProviderName;
  source: SelectionSource;
  originalUserSelection?: SlipSelection;
  /** Automatic picks arrive already analysed. */
  matchMetricRecommendation?: SlipPrediction;
  userSelectedPrediction?: SlipSelection;
}

export interface AutoPickFilters {
  /** Desired combined decimal price; 0 means "no target". */
  targetOdds: number;
  selectionCount: number;
  leagueIds: string[];
  mode: AutoPickMode;
  matchResultOnly: boolean;
  onePerLeague: boolean;
}

export interface AutoPick extends SlipPrediction {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  leagueFlag?: string;
  kickoff: string;
  dataQuality: PredictionDataQuality;
  confidence: PredictionConfidence;
  source: DataSource;
  modelVersion: string;
  generatedAt: string;
}

export interface AutoPicksResponse {
  picks: AutoPick[];
  evaluated: number;
  notice?: string;
}

/** A selection read back from an uploaded slip image, before it is trusted. */
export interface ExtractedSelection {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  market: string;
  selection: string;
  odds?: number;
  /** How confidently the entry could be read and matched to a MatchMetric fixture. */
  confidence: "high" | "medium" | "low";
  fixtureId?: string;
  note?: string;
}

export interface ScreenshotExtraction {
  fileName: string;
  /** Preview object URL, revoked when the session ends. */
  previewUrl: string;
  selections: ExtractedSelection[];
  /** Explicitly demonstration data until OCR is connected. */
  demonstration: boolean;
}

/**
 * One fixture compared side by side during Replay Game.
 *
 * `analysis` carries the engine's full result for the fixture so that converting the row can
 * rebuild the slip entry without rerunning the model or inventing any value.
 */
export interface ScreenshotComparisonRow {
  id: string;
  fixtureId?: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  analysable: boolean;
  userSelection: SlipSelection;
  recommendation?: SlipPrediction;
  status: SlipComparisonStatus;
  note: string;
  analysis?: Partial<SlipEntry>;
}

export const MAX_SLIP_ENTRIES = 5;
export const MAX_ALTERNATIVES = 4;
